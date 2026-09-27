import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import useSWR from 'swr'
import Big from 'big.js'
import { toast } from 'sonner'
import { Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react'
import useMutation from '../../lib/use-mutation'
import Input from '../lib/input'
import NumericInput from '../lib/numeric-input'
import SelectField from '../lib/select-field'
import ComboboxField from '../lib/combobox-field'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
   Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import type {
   PortfolioMarketsResponse, PortfolioSaveRequest, PortfolioSaveResponse, PortfolioSummary
} from '../../../types/api'

interface TargetRow {
   key: number
   asset: string
   weight: string
   stopPrice: string
}

interface EditorProps {
   apiBase: string
   quoteAsset: string
   open: boolean
   portfolio: PortfolioSummary | null
   onOpenChange: (open: boolean) => void
   onSaved: (id: number) => void
}

interface EditorFormProps {
   apiBase: string
   quoteAsset: string
   portfolio: PortfolioSummary | null
   onCancel: () => void
   onSaved: (id: number) => void
}

let nextKey = 0
const row = (asset = '', weight = '', stopPrice = ''): TargetRow =>
   ({ key: nextKey++, asset, weight, stopPrice })

function sumOf(rows: TargetRow[]): Big | null {
   try {
      return rows.reduce((sum, { weight }) => sum.plus(weight || 0), Big(0))
   }
   catch {
      return null
   }
}

function splitEqually(rows: TargetRow[]): TargetRow[] {
   if (rows.length === 0) return rows
   const share = Big(100).div(rows.length).round(2, Big.roundDown)
   const last = Big(100).minus(share.times(rows.length - 1))
   return rows.map((entry, index) => ({ ...entry, weight: (index === rows.length - 1 ? last : share).toFixed() }))
}

function currentWeights(portfolio: PortfolioSummary, rows: TargetRow[]): TargetRow[] {

   const quote = portfolio.quoteAsset
   const keepsCash = rows.some(({ asset }) => asset === quote)
   const held = portfolio.holdings
      .filter(({ asset, value }) => value !== null && Big(value).gt(0) && (asset !== quote || keepsCash))
      .map(({ asset, value }) => ({ asset, value: Big(value!) }))
   const total = held.reduce((sum, { value }) => sum.plus(value), Big(0))
   if (total.lte(0)) return rows

   const exact = held.map(({ asset, value }) => ({ asset, weight: value.div(total).times(100) }))
   const floors = exact.map(({ asset, weight }) => ({ asset, weight: weight.round(2, Big.roundDown), rest: weight.mod(Big('0.01')) }))
   const missing = Big(100).minus(floors.reduce((sum, { weight }) => sum.plus(weight), Big(0))).div(Big('0.01')).toNumber()
   const topped = new Set([...floors].sort((left, right) => right.rest.cmp(left.rest)).slice(0, missing).map(({ asset }) => asset))
   const weights = new Map(floors.map(({ asset, weight }) => [asset, topped.has(asset) ? weight.plus(Big('0.01')) : weight]))

   const kept = rows
      .filter(({ asset }) => weights.get(asset)?.gt(0))
      .map(entry => ({ ...entry, weight: weights.get(entry.asset)!.toFixed() }))
   const listed = new Set(kept.map(({ asset }) => asset))
   const added = [...weights]
      .filter(([asset, weight]) => !listed.has(asset) && weight.gt(0))
      .map(([asset, weight]) => row(asset, weight.toFixed()))

   return [...kept, ...added]
}

function EditorForm({ apiBase, quoteAsset: defaultQuote, portfolio, onCancel, onSaved }: EditorFormProps) {

   const [name, setName] = useState(portfolio?.name ?? '')
   const [quoteAsset, setQuoteAsset] = useState(portfolio?.quoteAsset ?? defaultQuote)
   const [band, setBand] = useState(portfolio?.band ?? '1')
   const [rows, setRows] = useState<TargetRow[]>(() => portfolio
      ? portfolio.targets.map(({ asset, weight, stopPrice }) => row(asset, weight, stopPrice ?? ''))
      : [row('BTC', '50'), row('ETH', '30'), row(defaultQuote, '20')])
   const [error, setError] = useState<string | null>(null)
   const rowActions = useRef<HTMLDivElement>(null)

   const { data: markets, isLoading: isLoadingMarkets } =
      useSWR<PortfolioMarketsResponse>(`${apiBase}/markets`, { revalidateOnFocus: false })
   const { trigger: save, isMutating: isSaving } =
      useMutation<PortfolioSaveResponse, PortfolioSaveRequest>(`${apiBase}/save`)

   const quoteOptions = (markets?.quoteAssets ?? [defaultQuote]).map(asset => ({ value: asset, label: asset }))
   const assetOptions = [
      { value: quoteAsset, label: `${quoteAsset} (cash)` },
      ...(markets?.markets ?? [])
         .filter(({ quote }) => quote === quoteAsset)
         .map(({ base }) => ({ value: base, label: base }))
   ]

   const chosen = new Set(rows.map(({ asset }) => asset))
   const optionsFor = (asset: string) =>
      assetOptions.filter(({ value }) => value === asset || !chosen.has(value))

   const sum = sumOf(rows)
   const balanced = sum?.eq(100) ?? false
   const unpriced = portfolio?.holdings.some(({ value, quantity }) => value === null && Big(quantity).gt(0)) ?? false

   const update = (key: number, changes: Partial<TargetRow>) =>
      setRows(current => current.map(entry => entry.key === key ? { ...entry, ...changes } : entry))

   const addRow = () => {
      flushSync(() => setRows(current => [...current, row()]))
      rowActions.current?.scrollIntoView({ block: 'nearest' })
   }

   const submit = async () => {
      setError(null)
      try {
         const { id } = await save({
            id: portfolio?.id,
            name,
            quoteAsset,
            band,
            targets: rows.filter(({ asset }) => asset).map(({ asset, weight, stopPrice }) =>
               ({ asset, weight, stopPrice: stopPrice.trim() || null }))
         })
         toast.success(portfolio ? `${name} saved.` : `${name} created.`)
         onSaved(id)
      }
      catch (reason) {
         setError(typeof reason === 'string' ? reason : 'The portfolio could not be saved.')
      }
   }

   return (
      <>
         <DialogHeader>
            <DialogTitle>{portfolio ? `Edit ${portfolio.name}` : 'New portfolio'}</DialogTitle>
            <DialogDescription>
               The weights the portfolio is rebalanced back to. They must add up to exactly 100%.
               Anything held that is not listed here is sold on the next rebalance.
               A stop price rests a stop order on the exchange that sells the whole holding at market
               once the price falls to it.
            </DialogDescription>
         </DialogHeader>

         <div className="-mx-6 min-h-0 space-y-4 overflow-y-auto px-6">
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
               <Input name="portfolio-name" label="Name" value={name} onChange={event => setName(event.target.value)} />
               <SelectField
                  name="portfolio-quote"
                  label="Cash coin"
                  value={quoteAsset}
                  disabled={portfolio?.quoteLocked}
                  onValueChange={setQuoteAsset}
                  options={quoteOptions} />
               <NumericInput
                  name="portfolio-band"
                  label="Band (± pt)"
                  value={band}
                  onChange={event => setBand(event.target.value)} />
            </div>

            <div className="space-y-2">
               {rows.map(entry =>
                  <div key={entry.key} className="grid grid-cols-[minmax(0,1fr)_6rem_7rem_auto] items-end gap-2">
                     <ComboboxField
                        name={`target-asset-${entry.key}`}
                        label="Asset"
                        value={entry.asset}
                        disabled={isLoadingMarkets}
                        onValueChange={asset => update(entry.key, { asset })}
                        options={optionsFor(entry.asset)}
                        placeholder={isLoadingMarkets ? 'Loading markets…' : 'Choose an asset'}
                        searchPlaceholder="Search assets…" />
                     <NumericInput
                        name={`target-weight-${entry.key}`}
                        label="Weight (%)"
                        value={entry.weight}
                        onChange={event => update(entry.key, { weight: event.target.value })} />
                     <NumericInput
                        name={`target-stop-${entry.key}`}
                        label="Stop price"
                        value={entry.stopPrice}
                        disabled={entry.asset === quoteAsset}
                        onChange={event => update(entry.key, { stopPrice: event.target.value })} />
                     <Button
                        size="icon"
                        variant="ghost"
                        title="Remove"
                        onClick={() => setRows(current => current.filter(({ key }) => key !== entry.key))}>
                        <Trash2Icon /><span className="sr-only">Remove</span>
                     </Button>
                  </div>)}

               <div ref={rowActions} className="flex flex-wrap items-center gap-2">
                  <Button
                     size="sm"
                     variant="outline"
                     disabled={!isLoadingMarkets && rows.length >= assetOptions.length}
                     onClick={addRow}>
                     <PlusIcon /> Add asset
                  </Button>
                  <Button size="sm" variant="ghost" disabled={rows.length === 0} onClick={() => setRows(splitEqually)}>
                     Split equally
                  </Button>
                  {portfolio && portfolio.valueNum > 0 &&
                     <Button
                        size="sm"
                        variant="ghost"
                        disabled={unpriced}
                        title={unpriced
                           ? 'A coin the portfolio holds has no price right now, so its weight is unknown.'
                           : 'Set each weight to what the coin is worth in the portfolio today. Coins it holds none of are removed.'}
                        onClick={() => setRows(current => currentWeights(portfolio, current))}>
                        Use current weights
                     </Button>}
                  <span className={cn('ml-auto text-sm tabular-nums', balanced ? 'text-muted-foreground' : 'text-destructive')}>
                     Total {sum ? `${sum.toFixed()}%` : 'not a number'}
                  </span>
               </div>
            </div>

            <p className="text-xs text-muted-foreground">
               A stop order sells at market with no slippage cap, so a thin order book can fill it well
               below the stop price. When it fills, the coin is dropped from the targets and its weight
               moves to cash.
            </p>

            {portfolio?.quoteLocked &&
               <p className="text-xs text-muted-foreground">
                  The cash coin is fixed once money has moved through the portfolio.
               </p>}

            {error &&
               <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
               </Alert>}
         </div>

         <DialogFooter>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button disabled={isSaving || !balanced || !name.trim()} onClick={submit}>
               {isSaving && <Loader2Icon className="animate-spin" />}
               {portfolio ? 'Save' : 'Create'}
            </Button>
         </DialogFooter>
      </>
   )
}

export default function PortfolioEditorDialog({ apiBase, quoteAsset, open, portfolio, onOpenChange, onSaved }: EditorProps) {
   return (
      <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-xl">
            {open &&
               <EditorForm
                  key={portfolio?.id ?? 'new'}
                  apiBase={apiBase}
                  quoteAsset={quoteAsset}
                  portfolio={portfolio}
                  onCancel={() => onOpenChange(false)}
                  onSaved={onSaved} />}
         </DialogContent>
      </Dialog>
   )
}
