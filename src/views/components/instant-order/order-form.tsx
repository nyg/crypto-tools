import { useState } from 'react'
import Big from 'big.js'
import useSWR from 'swr'
import { Loader2Icon } from 'lucide-react'
import useMutation from '../../lib/use-mutation'
import Field from '../lib/field'
import NumericInput from '../lib/numeric-input'
import SelectField from '../lib/select-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { asExactDecimal, asPercentage } from '../../../utils/format'
import { asQuantity } from '../portfolio/format'
import type {
   InstantOrder, InstantOrderAccountResponse, InstantOrderBookResponse, InstantOrderPlaceRequest,
   InstantOrderPlaceResponse, PortfolioMarket
} from '../../../types/api'
import type { OrderSide, SizeUnit } from '../../../types/portfolio'

const BOOK_REFRESH_MS = 3000

interface OrderFormProps {
   apiBase: string
   venueLabel: string
   market: PortfolioMarket
   onPlaced: (order: InstantOrder) => void
}

const floorTo = (value: Big, step: string) =>
   Big(step).gt(0) ? value.div(step).round(0, Big.roundDown).times(step) : value

export default function OrderForm({ apiBase, venueLabel, market, onPlaced }: OrderFormProps) {

   const { symbol, base, quote } = market
   const [side, setSide] = useState<OrderSide>('buy')
   const [unit, setUnit] = useState<SizeUnit>('quote')
   const [amount, setAmount] = useState('')
   const [error, setError] = useState<string | null>(null)

   const { data: book, error: bookError } = useSWR<InstantOrderBookResponse>(
      [`${apiBase}/book`, { symbol }], { refreshInterval: BOOK_REFRESH_MS, revalidateOnFocus: false })
   const { data: account, mutate: refreshAccount } = useSWR<InstantOrderAccountResponse>(
      [`${apiBase}/account`, { symbol }], { revalidateOnFocus: false })
   const { trigger: place, isMutating: isPlacing } =
      useMutation<InstantOrderPlaceResponse, InstantOrderPlaceRequest>(`${apiBase}/place`)

   const price = side === 'buy' ? book?.buyPrice : book?.sellPrice
   const sized = Number(amount) > 0 && price ? Big(amount) : null
   const quantity = sized && price ? floorTo(unit === 'base' ? sized : sized.div(price), account?.baseStep ?? '0') : null
   const fees = account?.fees?.[side]

   const max = () => {
      if (!account) return
      setUnit(side === 'buy' ? 'quote' : 'base')
      setAmount(side === 'buy' ? account.maxBuy : account.freeBase)
   }

   const submit = async () => {
      setError(null)
      try {
         const { order } = await place({ symbol, side, unit, amount })
         setAmount('')
         onPlaced(order)
         refreshAccount()
      }
      catch (reason) {
         setError(typeof reason === 'string' ? reason : 'The order could not be placed.')
      }
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle>{base}/{quote}</CardTitle>
            <CardDescription>
               The app sets the price: one tick inside the spread, on your side of it, and placed post-only, so
               it rests on the {venueLabel} book as a maker order and pays the maker fee. If the book moves onto
               that price before the order lands, {venueLabel} refuses it rather than fill it as a taker, and the
               app prices it again.
            </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
               <Field label="Best bid">{book ? asExactDecimal(book.bid) : '—'}</Field>
               <Field label="Best ask">{book ? asExactDecimal(book.ask) : '—'}</Field>
               <Field label={`Free ${base}`}>{account ? asQuantity(account.freeBase) : '—'}</Field>
               <Field label={`Free ${quote}`}>{account ? asQuantity(account.freeQuote) : '—'}</Field>
            </div>

            <Tabs value={side} onValueChange={value => setSide(value as OrderSide)}>
               <TabsList>
                  <TabsTrigger value="buy">Buy</TabsTrigger>
                  <TabsTrigger value="sell">Sell</TabsTrigger>
               </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-end gap-3">
               <NumericInput
                  name="instant-amount"
                  label="Amount"
                  className="min-w-40 flex-1"
                  value={amount}
                  onChange={event => setAmount(event.target.value)} />
               <SelectField
                  name="instant-unit"
                  label="In"
                  className="w-28"
                  value={unit}
                  onValueChange={value => setUnit(value as SizeUnit)}
                  options={[{ value: 'base', label: base }, { value: 'quote', label: quote }]} />
               <Button variant="outline" type="button" disabled={!account} onClick={max}>Max</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
               <Field label={side === 'buy' ? 'Limit price, under the ask' : 'Limit price, over the bid'}>
                  <span className="font-medium">{price ? `${asExactDecimal(price)} ${quote}` : '—'}</span>
               </Field>
               <Field label="Quantity">{quantity ? `≈ ${asQuantity(quantity.toFixed())} ${base}` : '—'}</Field>
               <Field label="Total">
                  {quantity && price ? `≈ ${asQuantity(quantity.times(price).toFixed())} ${quote}` : '—'}
               </Field>
               <Field label="Fee">
                  {fees ? `${asPercentage(Number(fees.maker))} maker, not ${asPercentage(Number(fees.taker))} taker` : '—'}
               </Field>
            </div>

            {(error || bookError) &&
               <Alert variant="destructive">
                  <AlertDescription>{error ?? (typeof bookError === 'string' ? bookError : 'The book could not be read.')}</AlertDescription>
               </Alert>}

            <Button disabled={isPlacing || !sized} onClick={submit}>
               {isPlacing && <Loader2Icon className="animate-spin" />}
               {side === 'buy' ? 'Buy' : 'Sell'} {base}
            </Button>
         </CardContent>
      </Card>
   )
}
