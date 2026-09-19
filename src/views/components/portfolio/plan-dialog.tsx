import { useEffect, useState } from 'react'
import Big from 'big.js'
import { toast } from 'sonner'
import { Loader2Icon, RefreshCwIcon } from 'lucide-react'
import useMutation from '../../lib/use-mutation'
import NumericInput from '../lib/numeric-input'
import RunProgress from './run-progress'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import type {
   PortfolioExecuteRequest, PortfolioPlanRequest, PortfolioPlanResponse, PortfolioRun,
   PortfolioRunResponse, PortfolioSummary
} from '../../../types/api'
import type { OrderSide } from '../../../types/portfolio'

export interface PlanTarget {
   portfolio: PortfolioSummary
   request: PortfolioPlanRequest
}

interface PlanDialogProps {
   apiBase: string
   venueLabel: string
   live: boolean
   target: PlanTarget | null
   onOpenChange: (open: boolean) => void
   onFinished: () => void
}

const sideColours: Record<OrderSide, string> = {
   buy: 'bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
   sell: 'bg-rose-600/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300'
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

function PlanPreview({ plan }: { plan: PortfolioPlanResponse }) {

   const quote = plan.quoteAsset

   return (
      <div className="space-y-4">
         {plan.orders.length > 0
            ? <Table className="text-[13px] tabular-nums">
               <TableHeader>
                  <TableRow>
                     <TableHead>Order</TableHead>
                     <TableHead className="text-right">Size</TableHead>
                     <TableHead className="text-right">Price now</TableHead>
                     <TableHead className="text-right">About</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {plan.orders.map((order, index) =>
                     <TableRow key={`${order.symbol}-${index}`}>
                        <TableCell>
                           <div className="flex items-center gap-2">
                              <Badge className={cn('w-10 capitalize', sideColours[order.side])}>{order.side}</Badge>
                              <span className="font-medium">{order.asset}</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-right">
                           {asQuantity(order.amount)} {order.unit === 'base' ? order.asset : quote}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{asQuantity(order.price)}</TableCell>
                        <TableCell className="text-right">{asQuoteAmount(order.value, quote)}</TableCell>
                     </TableRow>)}
               </TableBody>
            </Table>
            : <Alert>
               <AlertDescription>
                  {plan.kind === 'withdraw'
                     ? `No trade needed: the portfolio's ${quote} covers the withdrawal.`
                     : 'Nothing to trade: every asset is within its band or below the minimum order size.'}
               </AlertDescription>
            </Alert>}

         {plan.skipped.length > 0 &&
            <ul className="space-y-0.5 text-xs text-muted-foreground">
               {plan.skipped.map(skip =>
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

function PlanFlow({ apiBase, venueLabel, live, target, onOpenChange, onFinished }: PlanFlowProps) {

   const [band, setBand] = useState(target.request.band ?? target.portfolio.band)
   const [slippage, setSlippage] = useState(target.request.slippage ?? '1')
   const [confirming, setConfirming] = useState(false)
   const [runId, setRunId] = useState<string | null>(null)
   const [expiredPlan, setExpiredPlan] = useState<string | null>(null)

   const { data: plan, error: planError, trigger: preview, isMutating: isPlanning } =
      useMutation<PortfolioPlanResponse, PortfolioPlanRequest>(`${apiBase}/plan`)
   const { trigger: execute, isMutating: isExecuting } =
      useMutation<PortfolioRunResponse, PortfolioExecuteRequest>(`${apiBase}/execute`)

   const quote = target.portfolio.quoteAsset
   const expired = Boolean(plan) && expiredPlan === plan?.planId

   const requestPlan = () =>
      preview({ ...target.request, band: band || undefined, slippage }).catch(() => {})

   useEffect(() => {
      preview({ ...target.request, band, slippage }).catch(() => {})
   }, [])

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

   const finished = (run: PortfolioRun) => {
      const message = `${target.portfolio.name}: ${runStatusLabels[run.status].toLowerCase()}.`
      if (run.status === 'done') toast.success(message)
      else toast.warning(message)
      onFinished()
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
         <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
               <DialogTitle>{title} {target.portfolio.name} on {venueLabel}</DialogTitle>
               <DialogDescription>
                  {runId
                     ? 'The orders are placed one after the other: sells first, then buys sized to the cash the sells actually raised.'
                     : plan?.kind === 'withdraw'
                        ? `Withdrawing ${asQuoteAmount(plan.withdraw, quote)} of ${asQuoteAmount(plan.total, quote)}.`
                        : plan ? `Bringing ${asQuoteAmount(plan.total, quote)} back to its targets.` : 'Working out the orders…'}
               </DialogDescription>
            </DialogHeader>

            {runId
               ? <RunProgress apiBase={apiBase} runId={runId} quoteAsset={quote} onDone={finished} />
               : <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
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
                     <Button variant="outline" disabled={isPlanning} onClick={() => requestPlan()}>
                        {isPlanning ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
                        Preview again
                     </Button>
                  </div>

                  {Boolean(planError) &&
                     <Alert variant="destructive">
                        <AlertDescription>{String(planError)}</AlertDescription>
                     </Alert>}

                  {isPlanning && !plan && <Loader2Icon className="size-5 animate-spin text-muted-foreground" />}

                  {plan && <PlanPreview plan={plan} />}

                  {plan && hasOrders && !plan.canTrade &&
                     <Alert variant="destructive">
                        <AlertDescription>
                           This API key cannot place spot orders. Give it the Spot trade permission on
                           Bybit, then preview again.
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
               {!runId && plan && (hasOrders || plan.kind === 'withdraw') &&
                  <Button
                     variant={live ? 'destructive' : 'default'}
                     disabled={!canExecute || isPlanning}
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
                        ? `Place ${asCount(plan?.orders.length ?? 0, 'market order')} on ${venueLabel}?`
                        : `Withdraw ${asQuoteAmount(plan?.withdraw, quote)}?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                     {hasOrders && plan
                        ? <>
                           {tradeSummary(plan)}, with {live ? 'real' : 'demo'} funds. Market orders fill
                           at whatever the book offers, at most {plan.slippage}% away from the price at
                           the time; anything beyond that is cancelled. Filled orders cannot be undone.
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
