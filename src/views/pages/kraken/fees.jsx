import { useState } from 'react'
import { Link } from 'react-router'
import useSWR from 'swr'
import { InfoIcon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import FeeSummaryCard from '../../components/kraken/fee-summary-card'
import FeeChartCard from '../../components/kraken/fee-chart-card'
import FeeBreakdownCard from '../../components/kraken/fee-breakdown-card'
import { defaultFilters } from '../../components/kraken/ledger-filters'
import { Alert, AlertDescription } from '@/components/ui/alert'

const isUnfiltered = filters => Object.keys(defaultFilters)
   .every(key => filters[key] === defaultFilters[key])


export default function KrakenFees() {

   const [credentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.key')) || ''
   }))

   const [filters, setFilters] = useState(defaultFilters)
   const [filtersKey, setFiltersKey] = useState(0)
   const [asset, setAsset] = useState(null)
   const [granularity, setGranularity] = useState('month')

   // This page never contacts Kraken — it only reads the ledger the Ledger tab
   // already downloaded — so the secret is neither needed nor sent.
   const account = credentials.apiKey ? { apiKey: credentials.apiKey } : null

   const { data: fees, error, isLoading } = useSWR(
      account ? ['/api/kraken/ledger/fees', { credentials: account, filters }] : null,
      { keepPreviousData: true })

   const { data: filterOptions } = useSWR(
      account ? ['/api/kraken/ledger/filters', { credentials: account }] : null)

   if (!credentials.apiKey) {
      return (
         <KrakenLayout name="Fees">
            <Alert>
               <AlertDescription>
                  Generate an API key and secret on Kraken and add them in Settings to sync your ledger.
               </AlertDescription>
            </Alert>
         </KrakenLayout>
      )
   }

   // Colours are assigned from every entry type the ledger holds rather than the ones
   // left after filtering, so narrowing the range never repaints the types that survive.
   const knownTypes = [...new Set([
      ...(filterOptions?.types ?? []),
      ...(fees?.byType ?? []).map(row => row.type)
   ])].toSorted()

   const colors = new Map(knownTypes.map((type, index) => [type, `var(--chart-${(index % 8) + 1})`]))

   // Derived rather than stored: filtering the selected asset out of the results falls
   // back to the one charged most often instead of leaving the charts blank.
   const assetOptions = (fees?.assets ?? []).map(row => row.asset)
   const selectedAsset = assetOptions.includes(asset) ? asset : (assetOptions[0] ?? null)

   const changeFilters = (next) => setFilters(next)

   const resetFilters = () => {
      setFilters(defaultFilters)
      setFiltersKey(key => key + 1)
   }

   return (
      <KrakenLayout name="Fees">
         <div className="space-y-6">

            <div className="flex items-center gap-3 rounded-lg border border-blue-300/60 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/25 dark:bg-blue-950/30 dark:text-blue-100">
               <InfoIcon className="size-5 shrink-0" />
               <p>
                  Everything Kraken has charged you since the account was opened — mostly trade
                  fees, but also withdrawal fees and anything else the ledger records — read from
                  the local database the Ledger tab fills. Fees are kept in the asset they were
                  charged in and never converted, so each asset is totalled on its own.
               </p>
            </div>

            {error &&
               <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
               </Alert>}

            {fees?.entries === 0 && isUnfiltered(filters) &&
               <Alert>
                  <AlertDescription>
                     No ledger entries stored yet. Sync your ledger on the{' '}
                     <Link to="/kraken/ledger" className="font-medium text-foreground underline underline-offset-4">
                        Ledger
                     </Link>{' '}
                     tab first, then come back.
                  </AlertDescription>
               </Alert>}

            <FeeSummaryCard
               fees={fees}
               filters={filters}
               filtersKey={filtersKey}
               options={filterOptions}
               isLoading={isLoading}
               onFiltersChange={changeFilters}
               onFiltersReset={resetFilters} />

            <FeeChartCard
               fees={fees}
               colors={colors}
               assets={assetOptions}
               asset={selectedAsset}
               granularity={granularity}
               onAssetChange={setAsset}
               onGranularityChange={setGranularity} />

            <FeeBreakdownCard fees={fees} colors={colors} asset={selectedAsset} />

         </div>
      </KrakenLayout>
   )
}
