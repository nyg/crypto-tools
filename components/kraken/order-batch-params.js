import Checkbox from '../lib/checkbox'
import NumericInput from '../lib/numeric-input'
import Select from '../lib/select'
import { Button } from '@/components/ui/button'

export default function OrderBatchParameters({ formValues, setFormValues, tradingPairs, isLoading, onShowPreview, onCreateOrders }) {

   const handleChange = (name, value) => {
      setFormValues(prev => ({ ...prev, [name]: value }))
   }

   return (
      <div>
         <h3 className="pb-2 font-semibold">Parameters</h3>
         <div className="space-y-2">
            <form className="" onSubmit={(e) => e.preventDefault()}>
               <Select
                  name="pair"
                  label="Pair"
                  value={formValues.pair}
                  onChange={(e) => handleChange('pair', e.target.value)}
               >
                  {isLoading
                     ? <option>Loading...</option>
                     : (Object.keys(tradingPairs || {}).map(pair =>
                        <option key={pair} value={pair}>{tradingPairs[pair].name}</option>))}
               </Select>
               <Select
                  name="direction"
                  label="Direction"
                  value={formValues.direction}
                  onChange={(e) => handleChange('direction', e.target.value)}
               >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
               </Select>
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
               <Select
                  name="price-fn"
                  label="Price function"
                  value={formValues.priceFn}
                  onChange={(e) => handleChange('priceFn', e.target.value)}
               >
                  <option value="linear">Linear</option>
               </Select>
               <Select
                  name="volume-fn"
                  label="Volume function"
                  value={formValues.volumeFn}
                  onChange={(e) => handleChange('volumeFn', e.target.value)}
               >
                  <option value="linear-base">Linear (base currency)</option>
                  <option value="linear-quote">Linear (quote currency)</option>
               </Select>
               <Checkbox
                  name="dry-run"
                  label="Dry run"
                  checked={formValues.dryRun}
                  onChange={(e) => handleChange('dryRun', e.target.checked)}
               />
            </form>
            <div className="space-x-4">
               <Button variant="outline" size="sm" type="button" onClick={onShowPreview}>Show preview</Button>
               <Button size="sm" type="button" onClick={onCreateOrders}>Create orders</Button>
            </div>
         </div>
      </div>
   )
}
