import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import ComboboxField from '../lib/combobox-field'
import SelectField from '../lib/select-field'
import Input from '../lib/input'

// Radix Select cannot hold an empty string as a value, so "no filter" travels as
// this sentinel and is mapped back on the way out.
const ANY = 'any'

const withAnyOption = (values, label) => [
   { value: ANY, label },
   ...values.map(value => ({ value, label: value }))
]

const asDateInput = (timestamp) => timestamp
   ? new Date(timestamp).toISOString().slice(0, 10)
   : ''

export const defaultFilters = { asset: '', type: '', wallet: '', from: null, to: null, search: '' }

// Changing the filters from outside (Reset, or clicking a reference in the table)
// remounts this component through its key, so the search box needs no separate
// effect to stay in step with the filters it was given.
export default function LedgerFilters({ filters, options, onChange, onReset }) {

   const [search, setSearch] = useState(filters.search)

   // Typing shouldn't fire a request per keystroke.
   useEffect(() => {
      if (search === filters.search) return
      const timer = setTimeout(() => onChange({ ...filters, search }), 300)
      return () => clearTimeout(timer)
   }, [search, filters])

   const update = (changes) => onChange({ ...filters, ...changes })

   const isFiltered = filters.asset || filters.type || filters.wallet
      || filters.from || filters.to || filters.search

   return (
      <div className="space-y-3">
         <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-6">

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

            <Input
               name="ledger-from"
               type="date"
               label="From"
               value={asDateInput(filters.from)}
               onChange={(e) => update({ from: e.target.value ? Date.parse(`${e.target.value}T00:00:00Z`) : null })} />

            <Input
               name="ledger-to"
               type="date"
               label="To"
               value={asDateInput(filters.to)}
               onChange={(e) => update({ to: e.target.value ? Date.parse(`${e.target.value}T23:59:59Z`) : null })} />

            <Input
               name="ledger-search"
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
