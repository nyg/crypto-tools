import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import ComboboxField from '../lib/combobox-field'
import SelectField from '../lib/select-field'
import Input from '../lib/input'
import DateField from '../lib/date-field'
import { ANY, withAnyOption, asDateInput, fromDateValue, toDateValue } from '../lib/filter-options'

export const defaultFilters = { pair: '', direction: '', ordertype: '', from: null, to: null, search: '' }

// Changing the filters from outside (Reset, or clicking an id in the table)
// remounts this component through its key, so the search box needs no separate
// effect to stay in step with the filters it was given.
export default function TradeFilters({ filters, options, onChange, onReset }) {

   const [search, setSearch] = useState(filters.search)

   // Typing shouldn't fire a request per keystroke.
   useEffect(() => {
      if (search === filters.search) return
      const timer = setTimeout(() => onChange({ ...filters, search }), 300)
      return () => clearTimeout(timer)
   }, [search, filters])

   const update = (changes) => onChange({ ...filters, ...changes })

   const isFiltered = filters.pair || filters.direction || filters.ordertype
      || filters.from || filters.to || filters.search

   return (
      <div className="space-y-3">
         <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-6">

            <ComboboxField
               name="trade-pair"
               label="Pair"
               value={filters.pair}
               onValueChange={(value) => update({ pair: value })}
               options={[{ value: '', label: 'All pairs' },
                  ...(options?.pairs ?? []).map(pair => ({ value: pair, label: pair }))]}
               placeholder="All pairs"
               searchPlaceholder="Search pairs…"
               emptyText="No pair found." />

            <SelectField
               name="trade-direction"
               label="Side"
               value={filters.direction || ANY}
               onValueChange={(value) => update({ direction: value === ANY ? '' : value })}
               options={withAnyOption(options?.directions ?? [], 'Buy and sell')} />

            <SelectField
               name="trade-type"
               label="Type"
               value={filters.ordertype || ANY}
               onValueChange={(value) => update({ ordertype: value === ANY ? '' : value })}
               options={withAnyOption(options?.ordertypes ?? [], 'All types')} />

            <DateField
               name="trade-from"
               label="From"
               value={asDateInput(filters.from)}
               onValueChange={(value) => update({ from: fromDateValue(value) })} />

            <DateField
               name="trade-to"
               label="To"
               value={asDateInput(filters.to)}
               onValueChange={(value) => update({ to: toDateValue(value) })} />

            <Input
               name="trade-search"
               label="Search id"
               value={search}
               onChange={(e) => setSearch(e.target.value)} />

         </div>

         {isFiltered &&
            <Button variant="ghost" size="sm" type="button" onClick={onReset}>
               Reset filters
            </Button>}
      </div>
   )
}
