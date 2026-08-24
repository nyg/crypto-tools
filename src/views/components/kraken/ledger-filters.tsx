import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import ComboboxField from '../lib/combobox-field'
import SelectField from '../lib/select-field'
import Input from '../lib/input'
import DateField from '../lib/date-field'
import { ANY, withAnyOption, asDateInput, fromDateValue, toDateValue } from '../lib/filter-options'

export interface LedgerFilterValues {
   asset: string
   type: string
   wallet: string
   from: number | null
   to: number | null
   search: string
}

export const defaultFilters: LedgerFilterValues = {
   asset: '', type: '', wallet: '', from: null, to: null, search: ''
}

// Changing the filters from outside (Reset, or clicking a reference in the table)
// remounts this component through its key, so the search box needs no separate
// effect to stay in step with the filters it was given.
// showSearch is off on aggregate views, where narrowing to a single transaction id
// says nothing.
export default function LedgerFilters({ filters, options, onChange, onReset, showSearch = true }: {
   filters: LedgerFilterValues
   options?: { assets?: string[], types?: string[], wallets?: string[] }
   onChange: (filters: LedgerFilterValues) => void
   onReset: () => void
   showSearch?: boolean
}) {

   const [search, setSearch] = useState(filters.search)

   // Typing shouldn't fire a request per keystroke.
   useEffect(() => {
      if (search === filters.search) return
      const timer = setTimeout(() => onChange({ ...filters, search }), 300)
      return () => clearTimeout(timer)
   }, [search, filters])

   const update = (changes: Partial<LedgerFilterValues>) => onChange({ ...filters, ...changes })

   const isFiltered = filters.asset || filters.type || filters.wallet
      || filters.from || filters.to || (showSearch && filters.search)

   return (
      <div className="space-y-3">
         <div className={`grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 ${showSearch ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>

            <ComboboxField
               name="ledger-asset"
               label="Asset"
               value={filters.asset}
               onValueChange={(value) => update({ asset: value })}
               options={[{ value: '', label: 'All assets' },
                  ...(options?.assets ?? []).map(asset => ({ value: asset, label: asset }))]}
               placeholder="All assets"
               searchPlaceholder="Search assets…"
               emptyText="No asset found." />

            <SelectField
               name="ledger-type"
               label="Type"
               value={filters.type || ANY}
               onValueChange={(value) => update({ type: value === ANY ? '' : value })}
               options={withAnyOption(options?.types ?? [], 'All types')} />

            <SelectField
               name="ledger-wallet"
               label="Wallet"
               value={filters.wallet || ANY}
               onValueChange={(value) => update({ wallet: value === ANY ? '' : value })}
               options={withAnyOption(options?.wallets ?? [], 'All wallets')} />

            <DateField
               name="ledger-from"
               label="From"
               value={asDateInput(filters.from)}
               onValueChange={(value) => update({ from: fromDateValue(value) })} />

            <DateField
               name="ledger-to"
               label="To"
               value={asDateInput(filters.to)}
               onValueChange={(value) => update({ to: toDateValue(value) })} />

            {showSearch &&
               <Input
                  name="ledger-search"
                  label="Search id"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)} />}

         </div>

         {isFiltered &&
            <Button variant="ghost" size="sm" type="button" onClick={onReset}>
               Reset filters
            </Button>}
      </div>
   )
}
