import { useState } from 'react'
import Checkbox from '../lib/checkbox'
import NumericInput from '../lib/numeric-input'
import { Button } from '@/components/ui/button'
import {
   Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { asQuoteAmount } from './format'
import type { PortfolioPlanRequest, PortfolioSummary } from '../../../types/api'

interface WithdrawFormProps {
   venueLabel: string
   portfolio: PortfolioSummary
   onCancel: () => void
   onPreview: (portfolio: PortfolioSummary, request: PortfolioPlanRequest) => void
}

function WithdrawForm({ venueLabel, portfolio, onCancel, onPreview }: WithdrawFormProps) {

   const [amount, setAmount] = useState('')
   const [all, setAll] = useState(false)

   const quote = portfolio.quoteAsset
   const cash = portfolio.holdings.find(({ asset }) => asset === quote)?.quantity ?? '0'

   return (
      <>
         <DialogHeader>
            <DialogTitle>Withdraw from {portfolio.name}</DialogTitle>
            <DialogDescription>
               Releases {quote} from the portfolio back to the unallocated part of your account.
               Cash is used first ({asQuoteAmount(cash, quote)} available); the rest comes from
               selling the most overweight assets. Moving the money off {venueLabel} is up to you.
            </DialogDescription>
         </DialogHeader>

         <div className="space-y-3">
            {!all &&
               <NumericInput
                  name="withdraw-amount"
                  label={`Amount (${quote})`}
                  value={amount}
                  onChange={event => setAmount(event.target.value)} />}
            <Checkbox
               name="withdraw-all"
               checked={all}
               onChange={event => setAll(event.target.checked)}
               label={`Everything: sell every asset and release all of the ${quote}`} />
         </div>

         <DialogFooter>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button
               disabled={!all && !(Number(amount) > 0)}
               onClick={() => onPreview(portfolio, all
                  ? { portfolioId: portfolio.id, kind: 'withdraw', all: true }
                  : { portfolioId: portfolio.id, kind: 'withdraw', amount })}>
               Preview
            </Button>
         </DialogFooter>
      </>
   )
}

interface WithdrawDialogProps {
   venueLabel: string
   portfolio: PortfolioSummary | null
   onOpenChange: (open: boolean) => void
   onPreview: (portfolio: PortfolioSummary, request: PortfolioPlanRequest) => void
}

export default function WithdrawDialog({ venueLabel, portfolio, onOpenChange, onPreview }: WithdrawDialogProps) {
   return (
      <Dialog open={portfolio !== null} onOpenChange={onOpenChange}>
         <DialogContent>
            {portfolio &&
               <WithdrawForm
                  key={portfolio.id}
                  venueLabel={venueLabel}
                  portfolio={portfolio}
                  onCancel={() => onOpenChange(false)}
                  onPreview={onPreview} />}
         </DialogContent>
      </Dialog>
   )
}
