import Input from '../lib/input'
import Select from '../lib/select'

export default function OrderBatchParameters({ formValues, setFormValues, tradingPairs, isLoading, onShowPreview, onCreateOrders }) {

   const handleChange = (name, value) => {
      setFormValues(prev => ({ ...prev, [name]: value }))
   }

   return (
      <div>
         <h3 className="pb-2 font-semibold">Parameters</h3>
         <div className="space-y-2">
            <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
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
               <Input
                  name="price-from"
                  label="Starting price"
                  value={formValues.priceFrom}
                  onChange={(e) => handleChange('priceFrom', e.target.value)}
               />
               <Input
                  name="price-to"
                  label="Ending price"
                  value={formValues.priceTo}
                  onChange={(e) => handleChange('priceTo', e.target.value)}
               />
               <Input
                  name="volume"
                  label="Volume"
                  value={formValues.volume}
                  onChange={(e) => handleChange('volume', e.target.value)}
               />
               <Input
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
               <Input
                  name="dry-run"
                  label="Dry run"
                  type="checkbox"
                  checked={formValues.dryRun}
                  onChange={(e) => handleChange('dryRun', e.target.checked)}
               />
            </form>
            <div className="space-x-4">
               <input className="px-2 py-1 bg-gray-600 text-gray-100 rounded-sm hover:bg-gray-500" type="button" value="Show preview" onClick={onShowPreview} />
               <input className="px-2 py-1 bg-gray-600 text-gray-100 rounded-sm hover:bg-gray-500" type="button" value="Create orders" onClick={onCreateOrders} />
            </div>
         </div>
      </div>
   )
}
