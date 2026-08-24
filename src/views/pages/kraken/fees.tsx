import { useState } from 'react'
import { Link } from 'react-router'
import useSWR from 'swr'
import { Loader2Icon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import FeeChart from '../../components/kraken/fee-chart'
import FeeTable from '../../components/kraken/fee-table'
import LedgerFilters, { defaultFilters } from '../../components/kraken/ledger-filters'
import { useProvider } from '../../lib/use-settings'
import CredentialsAlert from '../../components/lib/credentials-alert'
import usePersistentState from '../../lib/use-persistent-state'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { asNumber } from '../../../utils/format'
import type { Granularity } from '../../components/kraken/fee-chart'
import type { LedgerFilterValues } from '../../components/kraken/ledger-filters'
import type { AssetRatesResponse, FeeSummary, LedgerFiltersResponse } from '../../../types/api'

const isUnfiltered = (filters: LedgerFilterValues) =>
   (Object.keys(defaultFilters) as (keyof LedgerFilterValues)[])
      .every(key => filters[key] === defaultFilters[key])


export default function KrakenFees() {

   const { configured, accountId, unreachable, isLoading: isLoadingSettings } = useProvider('kraken')

   const [filters, setFilters] = usePersistentState('kraken.fees.filters', defaultFilters)
   const [filtersKey, setFiltersKey] = useState(0)
   const [asset, setAsset] = useState<string | null>(null)
   const [granularity, setGranularity] = usePersistentState<Granularity>('kraken.fees.granularity', 'month')

   const { data: fees, error, isLoading } = useSWR<FeeSummary>(
      configured ? ['/api/kraken/ledger/fees', { accountId, filters }] : null,
      { keepPreviousData: true })

   const { data: filterOptions } = useSWR<LedgerFiltersResponse>(
      configured ? '/api/kraken/ledger/filters' : null)

   const assetOptions = (fees?.assets ?? []).map(row => row.asset)
   const { data: rateData } = useSWR<AssetRatesResponse>(
      assetOptions.length > 0 ? ['/api/kraken/asset-rates', { assets: assetOptions }] : null,
      { keepPreviousData: true })

   if (!isLoadingSettings && (unreachable || !configured)) {
      return (
         <KrakenLayout name="Fees">
            <CredentialsAlert unreachable={unreachable}>
               Generate an API key and secret on Kraken and add them in Settings to sync your ledger.
            </CredentialsAlert>
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
   const selectedAsset = asset !== null && assetOptions.includes(asset)
      ? asset
      : (assetOptions[0] ?? null)

   const changeFilters = (next: LedgerFilterValues) => setFilters(next)

   const resetFilters = () => {
      setFilters(defaultFilters)
      setFiltersKey(key => key + 1)
   }

   return (
      <KrakenLayout name="Fees">
         <div className="space-y-6">

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

            <Card>
               <CardHeader>
                  <CardTitle>Fees paid</CardTitle>
                  <CardAction>
                     {isLoading
                        ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                        : <Badge variant="outline">{asNumber(fees?.entries ?? 0)} charged</Badge>}
                  </CardAction>
               </CardHeader>
               <CardContent className="space-y-6">

                  <LedgerFilters
                     key={filtersKey}
                     filters={filters}
                     options={filterOptions}
                     onChange={changeFilters}
                     onReset={resetFilters}
                     showSearch={false} />

                  <div className="border-t border-border pt-6">
                     <FeeChart
                        fees={fees}
                        colors={colors}
                        assets={assetOptions}
                        asset={selectedAsset}
                        granularity={granularity}
                        onAssetChange={setAsset}
                        onGranularityChange={setGranularity} />
                  </div>

                  <div className="border-t border-border pt-6">
                     <FeeTable fees={fees} rates={rateData?.rates} />
                  </div>

               </CardContent>
            </Card>

         </div>
      </KrakenLayout>
   )
}
