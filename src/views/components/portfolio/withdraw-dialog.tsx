import { useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import useMutation from '../../lib/use-mutation'
import Checkbox from '../lib/checkbox'
import NumericInput from '../lib/numeric-input'
import SelectField from '../lib/select-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
   Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { asQuantity, asQuoteAmount } from './format'
import type {
   PortfolioMovementResponse, PortfolioPlanRequest, PortfolioSummary, PortfolioWithdrawRequest
} from '../../../types/api'

interface WithdrawFormProps {
   apiBase: string
   venueLabel: string
   portfolio: PortfolioSummary
   onCancel: () => void
   onPreview: (portfolio: PortfolioSummary, request: PortfolioPlanRequest) => void
   onWithdrawn: (portfolio: PortfolioSummary, asset: string, amount: string) => void
}

function WithdrawForm({ apiBase, venueLabel, portfolio, onCancel, onPreview, onWithdrawn }: WithdrawFormProps) {

   const quote = portfolio.quoteAsset
   const coins = portfolio.holdings.filter(({ asset, quantity }) => asset !== quote && Number(quantity) > 0)

   const [asset, setAsset] = useState(quote)
   const [amount, setAmount] = useState('')
   const [all, setAll] = useState(false)
   const [error, setError] = useState<string | null>(null)

   const { trigger: withdraw, isMutating } =
      useMutation<PortfolioMovementResponse, PortfolioWithdrawRequest>(`${apiBase}/withdraw`)

   const asItIs = asset !== quote
   const held = portfolio.holdings.find(holding => holding.asset === asset)?.quantity ?? '0'

   const changeAsset = (next: string) => {
      setAsset(next)
      setAmount('')
      setAll(false)
      setError(null)
   }

   const preview = () => onPreview(portfolio, all
      ? { portfolioId: portfolio.id, kind: 'withdraw', all: true }
      : { portfolioId: portfolio.id, kind: 'withdraw', amount })

   const withdrawAsItIs = async () => {
      setError(null)
      try {
         await withdraw(all ? { portfolioId: portfolio.id, asset, all: true } : { portfolioId: portfolio.id, asset, amount })
         onWithdrawn(portfolio, asset, all ? held : amount)
      }
      catch (reason) {
         setError(typeof reason === 'string' ? reason : 'The withdrawal could not be recorded.')
      }
   }

   return (
      <>
         <DialogHeader>
            <DialogTitle>Withdraw from {portfolio.name}</DialogTitle>
            <DialogDescription>
               {asItIs
                  ? <>
                     Releases {asset} from the portfolio back to the unallocated part of your account, as it
                     is: nothing is sold. It leaves at the price now, so what it gained or lost in the portfolio
                     counts as realized. Moving it off {venueLabel} is up to you.
                  </>
                  : <>
                     Releases {quote} from the portfolio back to the unallocated part of your account.
                     Cash is used first ({asQuoteAmount(held, quote)} available); the rest comes from
                     selling the most overweight assets. Moving the money off {venueLabel} is up to you.
                  </>}
            </DialogDescription>
         </DialogHeader>

         <div className="space-y-3">
            {coins.length > 0 &&
               <SelectField
                  name="withdraw-asset"
                  label="Coin"
                  value={asset}
                  onValueChange={changeAsset}
                  options={[
                     { value: quote, label: `${quote}, selling coins for it if needed` },
                     ...coins.map(coin => ({
                        value: coin.asset,
                        label: Number(coin.target) === 0 ? `${coin.asset}, not a target` : coin.asset
                     }))
                  ]} />}
            {!all &&
               <NumericInput
                  name="withdraw-amount"
                  label={`Amount (${asset})`}
                  value={amount}
                  onChange={event => setAmount(event.target.value)} />}
            <Checkbox
               name="withdraw-all"
               checked={all}
               onChange={event => setAll(event.target.checked)}
               label={asItIs
                  ? `Everything: all ${asQuantity(held)} ${asset}`
                  : `Everything: sell every asset and release all of the ${quote}`} />
         </div>

         {error &&
            <Alert variant="destructive">
               <AlertDescription>{error}</AlertDescription>
            </Alert>}

         <DialogFooter>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button
               disabled={isMutating || (!all && !(Number(amount) > 0))}
               onClick={asItIs ? withdrawAsItIs : preview}>
               {isMutating && <Loader2Icon className="animate-spin" />}
               {asItIs ? 'Withdraw' : 'Preview'}
            </Button>
         </DialogFooter>
      </>
   )
}

interface WithdrawDialogProps extends Omit<WithdrawFormProps, 'portfolio' | 'onCancel'> {
   portfolio: PortfolioSummary | null
   onOpenChange: (open: boolean) => void
}

export default function WithdrawDialog({ portfolio, onOpenChange, ...form }: WithdrawDialogProps) {
   return (
      <Dialog open={portfolio !== null} onOpenChange={onOpenChange}>
         <DialogContent>
            {portfolio &&
               <WithdrawForm
                  key={portfolio.id}
                  portfolio={portfolio}
                  onCancel={() => onOpenChange(false)}
                  {...form} />}
         </DialogContent>
      </Dialog>
   )
}
