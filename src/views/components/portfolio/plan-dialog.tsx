import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import Big from 'big.js'
import { toast } from 'sonner'
import { Loader2Icon, RefreshCwIcon } from 'lucide-react'
import useMutation from '../../lib/use-mutation'
import LoadingSpinner from '../lib/loading-spinner'
import NumericInput from '../lib/numeric-input'
import SelectField from '../lib/select-field'
import OrderLabel from './order-label'
import RunProgress from './run-progress'
import { SupertrendCell, SupertrendHead } from './supertrend-cell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
   AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
   AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
   Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { asCount } from '../lib/filter-options'
import { asQuantity, asQuoteAmount, runStatusLabels, skipReasons } from './format'
import { asPercentage } from '../../../utils/format'
import type { SupertrendColumns } from './supertrend-cell'
import type {
   PortfolioExecuteRequest, PortfolioPlanRequest, PortfolioPlanResponse, PortfolioRun,
   PortfolioRunResponse, PortfolioSummary, PortfolioSupertrendResponse
} from '../../../types/api'
import type { Execution, RebalanceMode } from '../../../types/portfolio'

export interface PlanTarget {
   portfolio: PortfolioSummary
   request: PortfolioPlanRequest
}

interface PlanDialogProps {
   apiBase: string
   venueLabel: string
   feesNote: string
   live: boolean
   target: PlanTarget | null
   onOpenChange: (open: boolean) => void
   onFinished: () => void
}

const totalOf = (plan: PortfolioPlanResponse, side: 'buy' | 'sell') =>
   plan.orders.filter(order => order.side === side).reduce((sum, { value }) => sum.plus(value), Big(0))

function tradeSummary(plan: PortfolioPlanResponse): string {
   const sells = totalOf(plan, 'sell')
   const buys = totalOf(plan, 'buy')
   const parts = [
      sells.gt(0) && `sells of about ${asQuoteAmount(sells.toFixed(), plan.quoteAsset)}`,
      buys.gt(0) && `buys of about ${asQuoteAmount(buys.toFixed(), plan.quoteAsset)}`
   ].filter(Boolean).join(' and ')
   return parts.charAt(0).toUpperCase() + parts.slice(1)
}

const modeOptions: { value: RebalanceMode, label: string }[] = [
   { value: 'full', label: 'Buy and sell' },
   { value: 'invest', label: 'Only buy, with the cash' },
   { value: 'trim', label: 'Only sell, keep the cash' }
]

const executionOptions: { value: Execution, label: string }[] = [
   { value: 'limit', label: 'Limit, maker only' },
   { value: 'market', label: 'Market' }
]

const DEFAULT_WAIT_SECONDS = '120'
const PREVIEW_DEBOUNCE_MS = 600

type PlanChanges = Pick<PortfolioPlanRequest, 'mode' | 'exclude' | 'execution' | 'amount'>

const otherExecution = (execution: Execution): Execution => execution === 'limit' ? 'market' : 'limit'

const leftToWithdraw = (run: PortfolioRun) => Big(run.withdraw).minus(run.withdrawn)

const feeRateTitles: Record<Execution, string> = {
   limit: 'Your maker fee rate on this pair, as the exchange reports it.',
   market: 'Your taker fee rate on this pair, as the exchange reports it.'
}

const assumedFeeRateTitles: Record<Execution, string> = {
   limit: 'The exchange did not report a rate for this pair, so this assumes its standard fee.',
   market: 'The exchange did not report a rate for this pair, so this assumes its standard taker fee.'
}

function describePlan(plan: PortfolioPlanResponse): string {
   const quote = plan.quoteAsset
   if (plan.kind === 'withdraw') return `Withdrawing ${asQuoteAmount(plan.withdraw, quote)} of ${asQuoteAmount(plan.total, quote)}.`
   if (plan.mode === 'invest') return `Spending the portfolio's ${quote} on the coins below their targets, without selling anything.`
   if (plan.mode === 'trim') return `Selling the coins above their targets and keeping the ${quote} in the portfolio.`
   return `Bringing ${asQuoteAmount(plan.total, quote)} back to its targets.`
}

interface PlanPreviewProps {
   plan: PortfolioPlanResponse
   portfolio: PortfolioSummary
   supertrend?: SupertrendColumns
   disabled: boolean
   onInclude: (asset: string, included: boolean) => void
}

function PlanPreview({ plan, portfolio, supertrend, disabled, onInclude }: PlanPreviewProps) {

   const quote = plan.quoteAsset
   const excluded = plan.skipped.filter(({ reason }) => reason === 'excluded')
   const leftAlone = plan.skipped.filter(({ reason }) => reason !== 'excluded')
   const priceOf = (asset: string) => portfolio.holdings.find(holding => holding.asset === asset)?.price ?? null

   const supertrendCells = (asset: string, price: string | null) => {
      if (!supertrend) return null
      const levels = supertrend.levels?.[`${asset}${quote}`]
      return (
         <>
            <SupertrendCell level={levels?.daily} price={price} loading={supertrend.loading} timeframe="daily" />
            <SupertrendCell level={levels?.weekly} price={price} loading={supertrend.loading} timeframe="weekly" />
         </>
      )
   }

   const includeBox = (asset: string, included: boolean) =>
      <Checkbox
         checked={included}
         disabled={disabled}
         aria-label={included ? `Leave ${asset} out` : `Trade ${asset}`}
         onCheckedChange={checked => onInclude(asset, checked === true)} />

   return (
      <div className="space-y-4">
         {(plan.orders.length > 0 || excluded.length > 0) &&
            <Table className="text-[13px] tabular-nums">
               <TableHeader>
                  <TableRow>
                     <TableHead className="w-8"><span className="sr-only">Trade</span></TableHead>
                     <TableHead>Order</TableHead>
                     <TableHead className="text-right">Size</TableHead>
                     <TableHead className="text-right">Price now</TableHead>
                     {supertrend && <>
                        <SupertrendHead timeframe="daily">Supertrend 1D</SupertrendHead>
                        <SupertrendHead timeframe="weekly">Supertrend 1W</SupertrendHead>
                     </>}
                     <TableHead className="text-right">Fee</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {plan.orders.map((order, index) =>
                     <TableRow key={`${order.symbol}-${index}`}>
                        <TableCell>{includeBox(order.asset, true)}</TableCell>
                        <TableCell><OrderLabel side={order.side} asset={order.asset} /></TableCell>
                        <TableCell className="text-right" title={`About ${asQuoteAmount(order.value, quote)}`}>
                           {order.unit === 'base' ? `${asQuantity(order.amount)} ${order.asset}` : asQuantity(order.amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{asQuantity(order.price)}</TableCell>
                        {supertrendCells(order.asset, priceOf(order.asset) ?? order.price)}
                        <TableCell
                           className="text-right text-muted-foreground"
                           title={(order.feeRateAssumed ? assumedFeeRateTitles : feeRateTitles)[plan.execution]}>
                           {order.feeRateAssumed ? '~' : ''}{asPercentage(Number(order.feeRate))}
                        </TableCell>
                     </TableRow>)}
                  {excluded.map(({ asset, value }) =>
                     <TableRow key={`excluded-${asset}`} className="text-muted-foreground">
                        <TableCell>{includeBox(asset, false)}</TableCell>
                        <TableCell>
                           <div className="flex items-center gap-2">
                              <span className="w-10" />
                              <span className="font-medium">{asset}</span>
                              <span className="text-xs">left out</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-right">{Number(value) > 0 ? asQuoteAmount(value) : '—'}</TableCell>
                        <TableCell className="text-right">{asQuantity(priceOf(asset))}</TableCell>
                        {supertrendCells(asset, priceOf(asset))}
                        <TableCell />
                     </TableRow>)}
               </TableBody>
            </Table>}

         {plan.orders.length === 0 &&
            <Alert>
               <AlertDescription>
                  {plan.kind === 'withdraw'
                     ? `No trade needed: the portfolio's ${quote} covers the withdrawal.`
                     : leftAlone.length > 0
                        ? 'Nothing to trade: the notes below say why each coin is left alone.'
                        : 'Nothing to trade.'}
               </AlertDescription>
            </Alert>}

         {leftAlone.length > 0 &&
            <ul className="space-y-0.5 text-xs text-muted-foreground">
               {leftAlone.map(skip =>
                  <li key={`${skip.asset}-${skip.reason}`}>
                     {skip.asset} left alone: {skipReasons[skip.reason]}
                     {Number(skip.value) > 0 && ` (about ${asQuoteAmount(skip.value, quote)})`}
                  </li>)}
            </ul>}

         {Number(plan.shortfall) > 0 &&
            <Alert variant="destructive">
               <AlertDescription>
                  After fees and minimum order sizes, the sells may raise about{' '}
                  {asQuoteAmount(plan.shortfall, quote)} less than requested. Whatever cash is
                  there once they settle is withdrawn.
               </AlertDescription>
            </Alert>}
      </div>
   )
}

interface PlanFlowProps extends Omit<PlanDialogProps, 'target'> {
   target: PlanTarget
}

function PlanFlow({ apiBase, venueLabel, feesNote, live, target, onOpenChange, onFinished }: PlanFlowProps) {

   const [band, setBand] = useState(target.request.band ?? target.portfolio.band)
   const [slippage, setSlippage] = useState(target.request.slippage ?? '1')
   const [mode, setMode] = useState<RebalanceMode>(target.request.mode ?? 'full')
   const [execution, setExecution] = useState<Execution>(target.request.execution ?? 'limit')
   const [wait, setWait] = useState(target.request.wait ?? DEFAULT_WAIT_SECONDS)
   const [exclude, setExclude] = useState<string[]>(target.request.exclude ?? [])
   const [amount, setAmount] = useState(target.request.amount)
   const [previewed, setPreviewed] = useState({ band, slippage, wait })
   const [confirming, setConfirming] = useState(false)
   const [runId, setRunId] = useState<string | null>(null)
   const [unfinished, setUnfinished] = useState<PortfolioRun | null>(null)
   const [expiredPlan, setExpiredPlan] = useState<string | null>(null)
   const latestPreview = useRef(0)

   const { data: plan, error: planError, trigger: preview, isMutating: isPlanning, reset: clearPlan } =
      useMutation<PortfolioPlanResponse, PortfolioPlanRequest>(`${apiBase}/plan`)
   const { trigger: execute, isMutating: isExecuting } =
      useMutation<PortfolioRunResponse, PortfolioExecuteRequest>(`${apiBase}/execute`)
   const { data: supertrend, isLoading: isLoadingSupertrend } =
      useSWR<PortfolioSupertrendResponse>(live ? `${apiBase}/supertrend` : null, { revalidateOnFocus: false })

   const quote = target.portfolio.quoteAsset
   const expired = Boolean(plan) && expiredPlan === plan?.planId
   const stale = previewed.band !== band || previewed.slippage !== slippage || previewed.wait !== wait

   const requestPlan = (changes: PlanChanges = {}) => {
      const asked = { band, slippage, wait }
      const request = ++latestPreview.current
      return preview({
         ...target.request, amount, band: band || undefined, slippage, mode, exclude, execution, wait, ...changes
      })
         .then(() => {
            if (request === latestPreview.current) setPreviewed(asked)
         })
         .catch(() => {})
   }

   const changeMode = (value: string) => {
      const next = modeOptions.find(option => option.value === value)?.value ?? 'full'
      setMode(next)
      requestPlan({ mode: next })
   }

   const changeExecution = (value: string) => {
      const next = executionOptions.find(option => option.value === value)?.value ?? 'limit'
      setExecution(next)
      requestPlan({ execution: next })
   }

   const include = (asset: string, included: boolean) => {
      const next = included ? exclude.filter(excludedAsset => excludedAsset !== asset) : [...exclude, asset]
      setExclude(next)
      requestPlan({ exclude: next })
   }

   useEffect(() => {
      requestPlan()
   }, [])

   useEffect(() => {
      if (!stale) return
      const timer = setTimeout(() => requestPlan(), PREVIEW_DEBOUNCE_MS)
      return () => clearTimeout(timer)
   }, [band, slippage, wait])

   useEffect(() => {
      if (!plan) return
      const timer = setTimeout(() => setExpiredPlan(plan.planId), Math.max(0, plan.expiresAt - Date.now()))
      return () => clearTimeout(timer)
   }, [plan])

   const confirm = async () => {
      if (!plan) return
      try {
         const { run } = await execute({ planId: plan.planId })
         setRunId(run.id)
         setConfirming(false)
      }
      catch (reason) {
         setConfirming(false)
         toast.error(typeof reason === 'string' ? reason : 'The orders could not be placed.')
      }
   }

   const withdrawsAmount = target.request.kind === 'withdraw' && !target.request.all

   const finished = (run: PortfolioRun) => {
      const message = `${target.portfolio.name}: ${runStatusLabels[run.status].toLowerCase()}.`
      if (run.status === 'done') toast.success(message)
      else toast.warning(message)
      if (run.status !== 'done' && (!withdrawsAmount || leftToWithdraw(run).gt(0))) setUnfinished(run)
      onFinished()
   }

   const retry = (run: PortfolioRun, next: Execution) => {
      const left = withdrawsAmount ? leftToWithdraw(run).toFixed() : undefined
      setExecution(next)
      setAmount(left)
      setRunId(null)
      setUnfinished(null)
      clearPlan()
      requestPlan({ execution: next, amount: left })
   }

   const close = () => {
      if (runId) onFinished()
      onOpenChange(false)
   }

   const hasOrders = (plan?.orders.length ?? 0) > 0
   const canExecute = plan && !expired && (hasOrders ? plan.canTrade : plan.kind === 'withdraw')
   const title = target.request.kind === 'withdraw' ? 'Withdraw' : 'Rebalance'

   return (
      <Dialog open onOpenChange={open => !isExecuting && !open && close()}>
         <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
               <DialogTitle>{title} {target.portfolio.name} on {venueLabel}</DialogTitle>
               <DialogDescription>
                  {runId
                     ? 'Sells first, then buys sized to the cash the sells actually raised.'
                     : plan ? describePlan(plan) : 'Working out the orders…'}
               </DialogDescription>
            </DialogHeader>

            {runId
               ? <div className="space-y-4">
                  <RunProgress key={runId} apiBase={apiBase} runId={runId} quoteAsset={quote} onDone={finished} />
                  {unfinished &&
                     <Alert>
                        <AlertDescription>
                           Not everything went through. Try what is left again with {unfinished.execution} orders,
                           or switch to {otherExecution(unfinished.execution)} orders: either way the orders are
                           previewed again before anything is placed.
                        </AlertDescription>
                     </Alert>}
               </div>
               : <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
                     {target.request.kind === 'rebalance' &&
                        <SelectField
                           name="plan-mode"
                           label="Trades"
                           className="w-56"
                           value={mode}
                           disabled={isPlanning}
                           onValueChange={changeMode}
                           options={modeOptions} />}
                     <SelectField
                        name="plan-execution"
                        label="Orders"
                        className="w-44"
                        value={execution}
                        disabled={isPlanning}
                        onValueChange={changeExecution}
                        options={executionOptions} />
                     {target.request.kind === 'rebalance' &&
                        <NumericInput
                           name="plan-band"
                           label="Band (± pt)"
                           className="w-32"
                           value={band}
                           onChange={event => setBand(event.target.value)} />}
                     <NumericInput
                        name="plan-slippage"
                        label="Max slippage (%)"
                        className="w-32"
                        value={slippage}
                        onChange={event => setSlippage(event.target.value)} />
                     {execution === 'limit' &&
                        <NumericInput
                           name="plan-wait"
                           label="Wait per order (s)"
                           className="w-36"
                           value={wait}
                           onChange={event => setWait(event.target.value)} />}
                     <Button variant="outline" disabled={isPlanning} onClick={() => requestPlan()}>
                        {isPlanning ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
                        Preview again
                     </Button>
                  </div>

                  {Boolean(planError) &&
                     <Alert variant="destructive">
                        <AlertDescription>{String(planError)}</AlertDescription>
                     </Alert>}

                  {isPlanning && !plan && <LoadingSpinner />}

                  {plan &&
                     <PlanPreview
                        plan={plan}
                        portfolio={target.portfolio}
                        supertrend={live ? { levels: supertrend?.levels, loading: isLoadingSupertrend } : undefined}
                        disabled={isPlanning}
                        onInclude={include} />}

                  {plan && hasOrders && <p className="text-xs text-muted-foreground">{feesNote}</p>}

                  {plan && hasOrders && !plan.canTrade &&
                     <Alert variant="destructive">
                        <AlertDescription>
                           This API key cannot place spot orders. Give it the Spot trade permission on
                           {' '}{venueLabel}, then preview again.
                        </AlertDescription>
                     </Alert>}

                  {plan && expired &&
                     <Alert>
                        <AlertDescription>This preview has expired: prices move. Preview again to place the orders.</AlertDescription>
                     </Alert>}
               </div>}

            <DialogFooter>
               <Button variant="outline" disabled={isExecuting} onClick={close}>
                  {runId ? 'Close' : 'Cancel'}
               </Button>
               {unfinished && <>
                  <Button variant="outline" onClick={() => retry(unfinished, otherExecution(unfinished.execution))}>
                     Switch to {otherExecution(unfinished.execution)} orders
                  </Button>
                  <Button onClick={() => retry(unfinished, unfinished.execution)}>
                     <RefreshCwIcon /> Retry with {unfinished.execution} orders
                  </Button>
               </>}
               {!runId && plan && (hasOrders || plan.kind === 'withdraw') &&
                  <Button
                     variant={live ? 'destructive' : 'default'}
                     disabled={!canExecute || isPlanning || stale}
                     onClick={() => setConfirming(true)}>
                     {hasOrders
                        ? `Place ${asCount(plan.orders.length, 'order')}`
                        : `Withdraw ${asQuoteAmount(plan.withdraw, quote)}`}
                  </Button>}
            </DialogFooter>
         </DialogContent>

         <AlertDialog open={confirming} onOpenChange={open => !isExecuting && setConfirming(open)}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>
                     {hasOrders
                        ? `Place ${asCount(plan?.orders.length ?? 0, `${plan?.execution ?? 'limit'} order`)} on ${venueLabel}?`
                        : `Withdraw ${asQuoteAmount(plan?.withdraw, quote)}?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                     {hasOrders && plan
                        ? <>
                           {tradeSummary(plan)}, with {live ? 'real' : 'demo'} funds.{' '}
                           {plan.execution === 'limit'
                              ? <>
                                 Each order rests on the book one tick inside the spread, as a maker only,
                                 and follows the price for up to {plan.wait} s, at most {plan.slippage}% away
                                 from the price now; what has not filled by then is cancelled.
                              </>
                              : <>
                                 Market orders fill at whatever the book offers, at most {plan.slippage}% away
                                 from the price at the time; anything beyond that is cancelled.
                              </>}
                           {' '}Filled orders cannot be undone.
                        </>
                        : `The ${quote} leaves the portfolio and becomes unallocated in your account. No order is placed.`}
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel disabled={isExecuting}>Not now</AlertDialogCancel>
                  <AlertDialogAction
                     variant={live && hasOrders ? 'destructive' : 'default'}
                     disabled={isExecuting}
                     onClick={event => { event.preventDefault(); confirm() }}>
                     {isExecuting && <Loader2Icon className="size-4 animate-spin" />}
                     {hasOrders ? 'Place the orders' : 'Withdraw'}
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </Dialog>
   )
}

export default function PlanDialog(props: PlanDialogProps) {
   return props.target ? <PlanFlow {...props} target={props.target} /> : null
}
