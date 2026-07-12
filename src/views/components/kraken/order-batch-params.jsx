import NumericInput from '../lib/numeric-input'
import SelectField from '../lib/select-field'
import { Button } from '@/components/ui/button'

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

export default function OrderBatchParameters({ formValues, setFormValues, tradingPairs, isLoading, onShowPreview, onCreateDryRun, onCreateLive }) {

   const handleChange = (name, value) => {
      setFormValues(prev => ({ ...prev, [name]: value }))
   }

   const pairOptions = Object.keys(tradingPairs || {}).map(pair => ({ value: pair, label: tradingPairs[pair].name }))

   return (
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
         <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            <SelectField
               name="pair"
               label="Pair"
               value={formValues.pair}
               onValueChange={(value) => handleChange('pair', value)}
               options={pairOptions}
               placeholder={isLoading ? 'Loading…' : undefined}
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
         </div>

         <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onShowPreview}>Show preview</Button>
            <Button variant="secondary" size="sm" type="button" onClick={onCreateDryRun}>Create orders (dry run)</Button>
            <Button size="sm" type="button" onClick={onCreateLive}>Create orders</Button>
         </div>
      </form>
   )
}
