import { Button } from '@/components/ui/button'
import SelectField from '../lib/select-field'
import Input from '../lib/input'
import Checkbox from '../lib/checkbox'
import { ANY } from '../lib/filter-options'

// Dust is hidden to begin with: a long tail of positions left over from a swap or a
// delisting is what makes this list unreadable, and how many are hidden is spelled out
// under the table rather than only in the checkbox.
export const DUST_USD = 1

export const defaultFilters = { placement: '', search: '', hideDust: true }

// Everything here is local — the whole table is already on the page — so the search box
// is bound straight to the filters instead of being debounced into a request.
export default function BalanceFilters({ filters, options, onChange, onReset }) {

   const update = (changes) => onChange({ ...filters, ...changes })

   const isFiltered = filters.placement || filters.search
      || filters.hideDust !== defaultFilters.hideDust

   return (
      <div className="space-y-3">
         <div className="grid grid-cols-2 items-end gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-6">

            <SelectField
               name="balance-placement"
               label="Placement"
               value={filters.placement || ANY}
               onValueChange={(value) => update({ placement: value === ANY ? '' : value })}
               options={[{ value: ANY, label: 'Anywhere' }, ...(options?.placements ?? [])]} />

            <Input
               name="balance-search"
               label="Search asset"
               value={filters.search}
               onChange={(e) => update({ search: e.target.value })} />

            <Checkbox
               name="balance-hide-dust"
               className="h-9"
               checked={filters.hideDust}
               onChange={(e) => update({ hideDust: e.target.checked })}
               label={`Hide under $${DUST_USD}`} />

         </div>

         {isFiltered &&
            <Button variant="ghost" size="sm" type="button" onClick={onReset}>
               Reset filters
            </Button>}
      </div>
   )
}
