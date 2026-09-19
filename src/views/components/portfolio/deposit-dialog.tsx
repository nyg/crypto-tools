import { useState } from 'react'
import Big from 'big.js'
import { Loader2Icon } from 'lucide-react'
import useMutation from '../../lib/use-mutation'
import NumericInput from '../lib/numeric-input'
import SelectField from '../lib/select-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
   Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { asQuantity } from './format'
import type {
   AccountCoin, PortfolioMovementRequest, PortfolioMovementResponse, PortfolioSummary
} from '../../../types/api'

interface DepositFormProps {
   apiBase: string
   portfolio: PortfolioSummary
   coins: AccountCoin[]
   onCancel: () => void
   onDeposited: (portfolio: PortfolioSummary, asset: string, amount: string) => void
}

const minOf = (left: string, right: string) => Big(left).lt(right) ? left : right

function DepositForm({ apiBase, portfolio, coins, onCancel, onDeposited }: DepositFormProps) {

   const quote = portfolio.quoteAsset
   const depositable = new Set([quote, ...portfolio.targets.map(({ asset }) => asset)])
   const available = coins
      .filter(coin => depositable.has(coin.asset) && Big(coin.unallocated).gt(0) && Big(coin.free).gt(0))
      .toSorted((left, right) => (left.asset === quote ? -1 : right.asset === quote ? 1 : right.valueNum - left.valueNum))

   const [asset, setAsset] = useState(() => available[0]?.asset ?? '')
   const [amount, setAmount] = useState('')
   const [error, setError] = useState<string | null>(null)

   const { trigger: deposit, isMutating } =
      useMutation<PortfolioMovementResponse, PortfolioMovementRequest>(`${apiBase}/deposit`)

   const selected = available.find(coin => coin.asset === asset)
   const max = selected ? minOf(selected.unallocated, selected.free) : '0'

   const submit = async () => {
      setError(null)
      try {
         await deposit({ portfolioId: portfolio.id, asset, amount })
         onDeposited(portfolio, asset, amount)
      }
      catch (reason) {
         setError(typeof reason === 'string' ? reason : 'The deposit could not be recorded.')
      }
   }

   return (
      <>
         <DialogHeader>
            <DialogTitle>Deposit into {portfolio.name}</DialogTitle>
            <DialogDescription>
               Moves {quote}, or a coin this portfolio targets, from the part of your Bybit account
               no portfolio holds into this one. Nothing is traded; rebalance afterwards to put the
               deposit to work.
            </DialogDescription>
         </DialogHeader>

         {available.length === 0
            ? <Alert>
               <AlertDescription>
                  No {quote} or target coin of this portfolio is free outside your portfolios.
                  Transfer some into your Bybit unified trading account first.
               </AlertDescription>
            </Alert>
            : <div className="grid gap-3 sm:grid-cols-2">
               <SelectField
                  name="deposit-asset"
                  label="Coin"
                  value={asset}
                  onValueChange={setAsset}
                  options={available.map(coin => ({ value: coin.asset, label: coin.asset }))} />
               <div className="space-y-1">
                  <NumericInput
                     name="deposit-amount"
                     label="Amount"
                     value={amount}
                     onChange={event => setAmount(event.target.value)} />
                  <button
                     type="button"
                     className="pl-2.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
                     onClick={() => setAmount(max)}>
                     Max {asQuantity(max)} {asset}
                  </button>
               </div>
            </div>}

         {error &&
            <Alert variant="destructive">
               <AlertDescription>{error}</AlertDescription>
            </Alert>}

         <DialogFooter>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button disabled={isMutating || !asset || !(Number(amount) > 0)} onClick={submit}>
               {isMutating && <Loader2Icon className="animate-spin" />}
               Deposit
            </Button>
         </DialogFooter>
      </>
   )
}

interface DepositDialogProps {
   apiBase: string
   portfolio: PortfolioSummary | null
   coins: AccountCoin[]
   onOpenChange: (open: boolean) => void
   onDeposited: (portfolio: PortfolioSummary, asset: string, amount: string) => void
}

export default function DepositDialog({ apiBase, portfolio, coins, onOpenChange, onDeposited }: DepositDialogProps) {
   return (
      <Dialog open={portfolio !== null} onOpenChange={onOpenChange}>
         <DialogContent>
            {portfolio &&
               <DepositForm
                  key={portfolio.id}
                  apiBase={apiBase}
                  portfolio={portfolio}
                  coins={coins}
                  onCancel={() => onOpenChange(false)}
                  onDeposited={onDeposited} />}
         </DialogContent>
      </Dialog>
   )
}
