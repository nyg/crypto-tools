import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import useSWR, { useSWRConfig } from 'swr'
import useMutation from '../../lib/use-mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import BalanceSummaryCard from '../../components/kraken/balance-summary-card'
import BalancePlacementCard from '../../components/kraken/balance-placement-card'
import BalanceChartCard from '../../components/kraken/balance-chart-card'
import BalanceTable from '../../components/kraken/balance-table'
import { defaultFilters } from '../../components/kraken/balance-filters'
import { isJobRunning } from '../../components/kraken/sync-status'
import { useProvider } from '../../lib/use-settings'
import CredentialsAlert from '../../components/lib/credentials-alert'
import SettingsLink from '../../components/lib/settings-link'
import usePersistentState from '../../lib/use-persistent-state'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { messageOf } from '@/lib/errors'
import type { AssetRatesResponse, BalanceSummary, BalancesResponse, SyncStatusResponse } from '../../../types/api'

const BALANCES_KEY = '/api/kraken/ledger/balances'


export default function KrakenBalances() {

   const { configured, unreachable, isLoading: isLoadingSettings } = useProvider('kraken')

   const [filters, setFilters] = usePersistentState('kraken.balances.filters', defaultFilters)

   const wasRunningRef = useRef(false)
   const { mutate } = useSWRConfig()

   // A sync is started on the Ledger page but rewrites the ledger totals checked here,
   // so the run is followed and the totals revalidated when it lands.
   useSWR<SyncStatusResponse>(
      configured ? '/api/kraken/ledger/sync/status' : null,
      {
         refreshInterval: latest => isJobRunning(latest?.job) ? 1500 : 0,
         onSuccess: (latest) => {
            const running = isJobRunning(latest?.job)
            if (!running && wasRunningRef.current) {
               mutate(BALANCES_KEY)
            }
            wasRunningRef.current = running
         }
      })

   const { data: ledger, error } = useSWR<BalanceSummary>(
      configured ? BALANCES_KEY : null,
      { keepPreviousData: true })

   // What Kraken says right now: every balance, where each part of it is allocated, and
   // the open orders holding part of it. It stays a mutation because it is the one call
   // here that reaches the exchange, and reaching it should be an action rather than
   // something a revalidation can repeat. Triggered on mount rather than left to a
   // button, so the page is complete without being asked twice.
   const { data: live, error: liveError, trigger, isMutating } =
      useMutation<BalancesResponse>('/api/kraken/balances')

   const checkLive = () => trigger().catch(() => {})

   // Asked for separately, and only once the assets are known, so a failed rate lookup
   // costs the amounts nothing.
   const assets = (live?.assets ?? []).map(asset => asset.asset)
   const { data: rateData, isLoading: isLoadingRates } = useSWR<AssetRatesResponse>(
      assets.length > 0 ? ['/api/kraken/asset-rates', { assets }] : null,
      { keepPreviousData: true })

   // Guarded because StrictMode runs this twice in development, and each run costs four
   // private calls against Kraken's rate limit. The button below is unaffected: it
   // calls checkLive directly.
   const hasCheckedRef = useRef(false)

   useEffect(() => {
      if (!configured || hasCheckedRef.current) return
      hasCheckedRef.current = true
      checkLive()
   }, [configured])

   if (!isLoadingSettings && (unreachable || !configured)) {
      return (
         <KrakenLayout name="Balances">
            <CredentialsAlert unreachable={unreachable}>
               Generate an API key and secret on Kraken and add them in <SettingsLink group="Kraken" /> to see your balances.
            </CredentialsAlert>
         </KrakenLayout>
      )
   }

   return (
      <KrakenLayout name="Balances">
         <div className="space-y-6">

            {error &&
               <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
               </Alert>}

            {liveError &&
               <Alert variant="destructive">
                  <AlertDescription>Could not read your balances from Kraken: {messageOf(liveError)}</AlertDescription>
               </Alert>}

            {ledger?.entries === 0 &&
               <Alert>
                  <AlertDescription>
                     No ledger stored yet, so these balances are not checked against it. Sync it on the{' '}
                     <Link to="/kraken/ledger" className="font-medium text-foreground underline underline-offset-4">
                        Ledger
                     </Link>{' '}
                     tab.
                  </AlertDescription>
               </Alert>}

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
               <BalanceSummaryCard
                  ledger={ledger}
                  rates={rateData?.rates}
                  live={live}
                  liveError={liveError}
                  isLoadingRates={isLoadingRates}
                  isLoadingLive={isMutating}
                  onRefreshLive={checkLive} />
               <BalancePlacementCard assets={live?.assets} rates={rateData?.rates} />
               <BalanceChartCard assets={live?.assets} rates={rateData?.rates} />
            </div>

            <BalanceTable
               assets={live?.assets}
               rates={rateData?.rates}
               filters={filters}
               onFiltersChange={setFilters}
               onReset={() => setFilters(defaultFilters)}
               isLoading={isMutating} />

         </div>
      </KrakenLayout>
   )
}
