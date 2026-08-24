import { Button } from '@/components/ui/button'
import ComboboxField from '../lib/combobox-field'
import SelectField from '../lib/select-field'
import NumericInput from '../lib/numeric-input'
import { ANY } from '../lib/filter-options'

// Dust is hidden to begin with: a long tail of positions left over from a swap or a
// delisting is what makes this list unreadable. The threshold is the user's to set,
// and clearing the field shows everything.
export const DEFAULT_DUST_USD = '1'

export const EARNING = 'earning'

// The Balances page filters locally over a table it already holds, so these are the
// page's own shape rather than anything the server understands.
export interface BalanceFilterValues {
   asset: string
   placement: string
   dust: string
}

export interface BalanceFilterOptions {
   assets?: string[]
   placements?: { value: string, label: string }[]
}

export const defaultFilters: BalanceFilterValues = { asset: '', placement: '', dust: DEFAULT_DUST_USD }

export const dustLimit = (filters: BalanceFilterValues): number => {
   const limit = Number(filters.dust)
   return Number.isFinite(limit) && limit > 0 ? limit : 0
}

// Everything here is local — the whole table is already on the page — so each field is
// bound straight to the filters instead of being debounced into a request.
export default function BalanceFilters({ filters, options, onChange, onReset }: {
   filters: BalanceFilterValues
   options?: BalanceFilterOptions
   onChange: (filters: BalanceFilterValues) => void
   onReset: () => void
}) {

   const update = (changes: Partial<BalanceFilterValues>) => onChange({ ...filters, ...changes })

   const isFiltered = filters.asset || filters.placement
      || filters.dust !== defaultFilters.dust

   return (
      <div className="space-y-3">
         <div className="grid grid-cols-2 items-end gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-6">

            <ComboboxField
               name="balance-asset"
               label="Asset"
               value={filters.asset}
               onValueChange={(value) => update({ asset: value })}
               options={[{ value: '', label: 'All assets' },
                  ...(options?.assets ?? []).map(asset => ({ value: asset, label: asset }))]}
               placeholder="All assets"
               searchPlaceholder="Search assets…"
               emptyText="No asset found." />

            <SelectField
               name="balance-placement"
               label="Placement"
               value={filters.placement || ANY}
               onValueChange={(value) => update({ placement: value === ANY ? '' : value })}
               options={[{ value: ANY, label: 'Anywhere' }, ...(options?.placements ?? [])]} />

            <NumericInput
               name="balance-dust"
               label="Hide under ($)"
               value={filters.dust}
               onChange={(e) => update({ dust: e.target.value })} />

         </div>

         {isFiltered &&
            <Button variant="ghost" size="sm" type="button" onClick={onReset}>
               Reset filters
            </Button>}
      </div>
   )
}
