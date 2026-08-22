import { Button } from '@/components/ui/button'
import ComboboxField from '../lib/combobox-field'
import SelectField from '../lib/select-field'
import Checkbox from '../lib/checkbox'
import DateField from '../lib/date-field'
import { asDateInput, fromDateValue, toDateValue } from '../lib/filter-options'

export const defaultFilters = { pairKey: '', includeAllQuotes: false, from: null, to: null, order: 'asc' }

const orderOptions = [
   { value: 'desc', label: 'Newest first' },
   { value: 'asc', label: 'Oldest first' }
]

export default function AggregateFilters({ filters, markets, onChange, onReset }) {

   const update = (changes) => onChange({ ...filters, ...changes })

   const isFiltered = Object.keys(defaultFilters).some(key => filters[key] !== defaultFilters[key])

   return (
      <div className="space-y-3">
         <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">

            <ComboboxField
               name="aggregate-pair"
               label="Pair"
               value={filters.pairKey}
               onValueChange={(value) => update({ pairKey: value })}
               options={markets.map(entry => ({ value: entry.pairKey, label: entry.pairKey }))}
               placeholder="Pick a pair"
               searchPlaceholder="Search pairs…"
               emptyText="No pair found." />

            <DateField
               name="aggregate-from"
               label="From"
               value={asDateInput(filters.from)}
               onValueChange={(value) => update({ from: fromDateValue(value) })} />

            <DateField
               name="aggregate-to"
               label="To"
               value={asDateInput(filters.to)}
               onValueChange={(value) => update({ to: toDateValue(value) })} />

            <SelectField
               name="aggregate-order"
               label="Order"
               value={filters.order}
               onValueChange={(value) => update({ order: value })}
               options={orderOptions} />

         </div>

         <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

            <Checkbox
               name="aggregate-all-quotes"
               checked={filters.includeAllQuotes}
               onChange={(e) => update({ includeAllQuotes: e.target.checked })}
               label="Include other fiat currencies and stablecoins" />

            {isFiltered &&
               <Button variant="ghost" size="sm" type="button" onClick={onReset}>
                  Reset filters
               </Button>}

         </div>
      </div>
   )
}
