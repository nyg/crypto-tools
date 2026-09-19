import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon } from 'lucide-react'
import useMutation from '../../lib/use-mutation'
import Input from '../lib/input'
import SelectField from '../lib/select-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
   Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import type {
   AccountCoin, PortfolioMovementRequest, PortfolioMovementResponse, PortfolioSummary
} from '../../../types/api'

interface AdjustFormProps {
   apiBase: string
   coin: AccountCoin
   portfolios: PortfolioSummary[]
   onCancel: () => void
   onAdjusted: () => void
}

function AdjustForm({ apiBase, coin, portfolios, onCancel, onAdjusted }: AdjustFormProps) {

   const holders = portfolios.filter(({ holdings }) =>
      holdings.some(({ asset, quantity }) => asset === coin.asset && Number(quantity) > 0))

   const [portfolioId, setPortfolioId] = useState(() => String(holders[0]?.id ?? ''))
   const [amount, setAmount] = useState(coin.unallocated)
   const [note, setNote] = useState('')
   const [error, setError] = useState<string | null>(null)

   const { trigger: adjust, isMutating } =
      useMutation<PortfolioMovementResponse, PortfolioMovementRequest>(`${apiBase}/adjust`)

   const submit = async () => {
      setError(null)
      try {
         await adjust({ portfolioId: Number(portfolioId), asset: coin.asset, amount, note })
         toast.success(`${coin.asset} adjusted.`)
         onAdjusted()
      }
      catch (reason) {
         setError(typeof reason === 'string' ? reason : 'The adjustment could not be recorded.')
      }
   }

   return (
      <>
         <DialogHeader>
            <DialogTitle>Adjust {coin.asset}</DialogTitle>
            <DialogDescription>
               Your portfolios hold more {coin.asset} than the wallet does, usually after a trade
               or withdrawal made outside this app. Record the difference against the portfolio
               it came out of. Nothing is traded.
            </DialogDescription>
         </DialogHeader>

         <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
               name="adjust-portfolio"
               label="Portfolio"
               value={portfolioId}
               onValueChange={setPortfolioId}
               options={holders.map(({ id, name }) => ({ value: String(id), label: name }))} />
            <Input
               name="adjust-amount"
               label={`Change (${coin.asset}, negative to remove)`}
               value={amount}
               onChange={event => setAmount(event.target.value)} />
            <Input
               name="adjust-note"
               label="Note"
               className="sm:col-span-2"
               value={note}
               onChange={event => setNote(event.target.value)} />
         </div>

         {error &&
            <Alert variant="destructive">
               <AlertDescription>{error}</AlertDescription>
            </Alert>}

         <DialogFooter>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button disabled={isMutating || !portfolioId || !amount} onClick={submit}>
               {isMutating && <Loader2Icon className="animate-spin" />}
               Record adjustment
            </Button>
         </DialogFooter>
      </>
   )
}

interface AdjustDialogProps {
   apiBase: string
   coin: AccountCoin | null
   portfolios: PortfolioSummary[]
   onOpenChange: (open: boolean) => void
   onAdjusted: () => void
}

export default function AdjustDialog({ apiBase, coin, portfolios, onOpenChange, onAdjusted }: AdjustDialogProps) {
   return (
      <Dialog open={coin !== null} onOpenChange={onOpenChange}>
         <DialogContent>
            {coin &&
               <AdjustForm
                  key={coin.asset}
                  apiBase={apiBase}
                  coin={coin}
                  portfolios={portfolios}
                  onCancel={() => onOpenChange(false)}
                  onAdjusted={onAdjusted} />}
         </DialogContent>
      </Dialog>
   )
}
