import NumericInput from '../lib/numeric-input'
import SelectField from '../lib/select-field'
import ComboboxField from '../lib/combobox-field'
import Input from '../lib/input'
import FieldHint from '../lib/field-hint'
import { Button } from '@/components/ui/button'
import type { Dispatch, SetStateAction } from 'react'
import type { TradingPairs } from '../../../types/market'

// The form as the user types it: every field is free text, parsed when the preview is
// built rather than on each keystroke.
export interface OrderBatchForm {
   pair: string
   direction: string
   priceFrom: string
   priceTo: string
   volume: string
   orderCount: string
   priceFn: string
   volumeFn: string
   userref?: string
}

const directionOptions = [
   { value: 'buy', label: 'Buy' },
   { value: 'sell', label: 'Sell' },
]

const priceFnOptions = [
   { value: 'linear', label: 'Linear' },
]

const volumeFnOptions = [
   { value: 'linear-base', label: 'Linear (base currency)' },
   { value: 'linear-quote', label: 'Linear (quote currency)' },
]

export default function OrderBatchParameters({
   formValues, setFormValues, tradingPairs, isLoading, onShowPreview, onCreateDryRun, onCreateLive
}: {
   formValues: OrderBatchForm
   setFormValues: Dispatch<SetStateAction<OrderBatchForm>>
   tradingPairs?: TradingPairs
   isLoading?: boolean
   onShowPreview: () => void
   onCreateDryRun: () => void
   onCreateLive: () => void
}) {

   const handleChange = (name: keyof OrderBatchForm, value: string) => {
      setFormValues(prev => ({ ...prev, [name]: value }))
   }

   const pairs = tradingPairs ?? {}
   const pairOptions = Object.keys(pairs).map(pair => ({ value: pair, label: pairs[pair].name }))

   return (
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
         <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-5">
            <ComboboxField
               name="pair"
               label="Pair"
               value={formValues.pair}
               onValueChange={(value) => handleChange('pair', value)}
               options={pairOptions}
               placeholder={isLoading ? 'Loading…' : 'Select a pair'}
               searchPlaceholder="Search pairs…"
               emptyText="No pair found."
               disabled={isLoading}
            />
            <SelectField
               name="direction"
               label="Direction"
               value={formValues.direction}
               onValueChange={(value) => handleChange('direction', value)}
               options={directionOptions}
            />
            <NumericInput
               name="price-from"
               label="Starting price"
               value={formValues.priceFrom}
               onChange={(e) => handleChange('priceFrom', e.target.value)}
            />
            <NumericInput
               name="price-to"
               label="Ending price"
               value={formValues.priceTo}
               onChange={(e) => handleChange('priceTo', e.target.value)}
            />
            <NumericInput
               name="volume"
               label="Volume"
               value={formValues.volume}
               onChange={(e) => handleChange('volume', e.target.value)}
            />
            <NumericInput
               name="order-count"
               label="Number of orders"
               value={formValues.orderCount}
               onChange={(e) => handleChange('orderCount', e.target.value)}
            />
            <SelectField
               name="price-fn"
               label="Price function"
               value={formValues.priceFn}
               onValueChange={(value) => handleChange('priceFn', value)}
               options={priceFnOptions}
            />
            <SelectField
               name="volume-fn"
               label="Volume function"
               value={formValues.volumeFn}
               onValueChange={(value) => handleChange('volumeFn', value)}
               options={volumeFnOptions}
            />
            <Input
               name="userref"
               type="number"
               label="Reference"
               hint={
                  <FieldHint label="About the reference">
                     Optional whole number sent as Kraken&apos;s <span className="font-mono">userref</span> on
                     every order in the batch. It shows as a column on the Open Orders page, so you can
                     tell this series apart from your other orders.
                  </FieldHint>
               }
               value={formValues.userref ?? ''}
               onChange={(e) => handleChange('userref', e.target.value)}
            />
         </div>

         <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onShowPreview}>Show preview</Button>
            <Button variant="secondary" size="sm" type="button" onClick={onCreateDryRun}>Create orders (dry run)</Button>
            <Button size="sm" type="button" onClick={onCreateLive}>Create orders</Button>
         </div>
      </form>
   )
}
