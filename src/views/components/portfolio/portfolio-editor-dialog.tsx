import { useState } from 'react'
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
   open: boolean
   portfolio: PortfolioSummary | null
   onOpenChange: (open: boolean) => void
   onSaved: (id: number) => void
}

interface EditorFormProps {
   apiBase: string
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

function EditorForm({ apiBase, portfolio, onCancel, onSaved }: EditorFormProps) {

   const [name, setName] = useState(portfolio?.name ?? '')
   const [quoteAsset, setQuoteAsset] = useState(portfolio?.quoteAsset ?? 'USDT')
   const [band, setBand] = useState(portfolio?.band ?? '1')
   const [rows, setRows] = useState<TargetRow[]>(() => portfolio
      ? portfolio.targets.map(({ asset, weight, stopPrice }) => row(asset, weight, stopPrice ?? ''))
      : [row('BTC', '50'), row('ETH', '30'), row('USDT', '20')])
   const [error, setError] = useState<string | null>(null)

   const { data: markets, isLoading: isLoadingMarkets } =
      useSWR<PortfolioMarketsResponse>(`${apiBase}/markets`, { revalidateOnFocus: false })
   const { trigger: save, isMutating: isSaving } =
      useMutation<PortfolioSaveResponse, PortfolioSaveRequest>(`${apiBase}/save`)

   const quoteOptions = (markets?.quoteAssets ?? ['USDT', 'USDC']).map(asset => ({ value: asset, label: asset }))
   const assetOptions = [
      { value: quoteAsset, label: `${quoteAsset} (cash)` },
      ...(markets?.markets ?? [])
         .filter(({ quote }) => quote === quoteAsset)
         .map(({ base }) => ({ value: base, label: base }))
   ]

   const sum = sumOf(rows)
   const balanced = sum?.eq(100) ?? false

   const update = (key: number, changes: Partial<TargetRow>) =>
      setRows(current => current.map(entry => entry.key === key ? { ...entry, ...changes } : entry))

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

         <div className="space-y-4">
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
                  <div key={entry.key} className="grid grid-cols-[1fr_6rem_7rem_auto] items-end gap-2">
                     <ComboboxField
                        name={`target-asset-${entry.key}`}
                        label="Asset"
                        value={entry.asset}
                        disabled={isLoadingMarkets}
                        onValueChange={asset => update(entry.key, { asset })}
                        options={assetOptions}
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

               <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRows(current => [...current, row()])}>
                     <PlusIcon /> Add asset
                  </Button>
                  <Button size="sm" variant="ghost" disabled={rows.length === 0} onClick={() => setRows(splitEqually)}>
                     Split equally
                  </Button>
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

export default function PortfolioEditorDialog({ apiBase, open, portfolio, onOpenChange, onSaved }: EditorProps) {
   return (
      <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent className="sm:max-w-xl">
            {open &&
               <EditorForm
                  key={portfolio?.id ?? 'new'}
                  apiBase={apiBase}
                  portfolio={portfolio}
                  onCancel={() => onOpenChange(false)}
                  onSaved={onSaved} />}
         </DialogContent>
      </Dialog>
   )
}
