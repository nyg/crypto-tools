import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import useSWR, { useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import InfoBanner from '../../components/lib/info-banner'
import SyncStatusStrip from '../../components/kraken/sync-status-strip'
import BalanceSummaryCard from '../../components/kraken/balance-summary-card'
import BalancePlacementCard from '../../components/kraken/balance-placement-card'
import BalanceChartCard from '../../components/kraken/balance-chart-card'
import BalanceTable from '../../components/kraken/balance-table'
import { defaultFilters } from '../../components/kraken/balance-filters'
import { asCount } from '../../components/lib/filter-options'
import { isJobRunning } from '../../components/kraken/sync-status'
import { useProvider } from '../../lib/use-settings'
import usePersistentState from '../../lib/use-persistent-state'
import { Alert, AlertDescription } from '@/components/ui/alert'

const BALANCES_KEY = '/api/kraken/ledger/balances'


export default function KrakenBalances() {

   const { configured, isLoading: isLoadingSettings } = useProvider('kraken')

   const [filters, setFilters] = usePersistentState('kraken.balances.filters', defaultFilters)

   const wasRunningRef = useRef(false)
   const { mutate } = useSWRConfig()

   // A sync is started on the Ledger page but rewrites the balances read here, so the
   // run is followed and the summary revalidated when it lands.
   const { data: status } = useSWR(
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

   const { data: balances, error, isLoading } = useSWR(
      configured ? BALANCES_KEY : null,
      { keepPreviousData: true })

   // Asked for separately, and only once the assets are known, so the table renders
   // from the local database straight away and a failed rate lookup costs the amounts
   // nothing.
   const assets = (balances?.assets ?? []).map(asset => asset.asset)
   const { data: rateData, isLoading: isLoadingRates } = useSWR(
      assets.length > 0 ? ['/api/kraken/asset-rates', { assets }] : null,
      { keepPreviousData: true })

   // What Kraken says right now: the totals to check the stored ledger against, and the
   // open orders holding part of it. It stays a mutation because it is the one call here
   // that reaches the exchange, and reaching it should be an action rather than something
   // a revalidation can repeat. Triggered on mount rather than left to a button, so the
   // page is complete without being asked twice.
   const { data: live, error: liveError, trigger, isMutating } = useSWRMutation('/api/kraken/balances')

   const canCheckLive = configured
   const checkLive = () => trigger().catch(() => {})

   // Guarded because StrictMode runs this twice in development, and each run costs two
   // private calls against Kraken's rate limit. The button below is unaffected: it
   // calls checkLive directly.
   const hasCheckedRef = useRef(false)

   useEffect(() => {
      if (!canCheckLive || hasCheckedRef.current) return
      hasCheckedRef.current = true
      checkLive()
   }, [canCheckLive])

   if (!isLoadingSettings && !configured) {
      return (
         <KrakenLayout name="Balances">
            <Alert>
               <AlertDescription>
                  Generate an API key and secret on Kraken and add them in Settings to sync your ledger.
               </AlertDescription>
            </Alert>
         </KrakenLayout>
      )
   }

   return (
      <KrakenLayout name="Balances">
         <div className="space-y-6">

            <InfoBanner>
               What you hold, rebuilt from the local database the Ledger tab fills, and
               grouped by <b>where each coin actually sits</b> — your spot wallet, or one
               of Kraken&apos;s Earn strategies. Coins left in spot that are still being
               paid are marked <b>Opt-In Rewards</b>, since they keep earning without
               leaving the wallet they can be traded from. Totals are checked against
               Kraken live, which also says how much an open order has already reserved.
            </InfoBanner>

            {error &&
               <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
               </Alert>}

            {balances?.entries === 0 &&
               <Alert>
                  <AlertDescription>
                     No ledger stored yet. Sync it on the{' '}
                     <Link to="/kraken/ledger" className="font-medium text-foreground underline underline-offset-4">
                        Ledger
                     </Link>{' '}
                     tab first, then come back.
                  </AlertDescription>
               </Alert>}

            {!canCheckLive &&
               <Alert>
                  <AlertDescription>
                     Add your API secret in Settings to check these balances against Kraken and
                     see what your open orders have reserved.
                  </AlertDescription>
               </Alert>}

            <SyncStatusStrip
               state={status?.state}
               job={status?.job}
               isRunning={isJobRunning(status?.job)}
               counts={asCount(status?.state?.entryCount, 'ledger entry', 'ledger entries')}
               emptyLabel="No ledger stored yet" />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
               <BalanceSummaryCard
                  balances={balances}
                  rates={rateData?.rates}
                  live={live}
                  liveError={liveError}
                  isLoading={isLoading}
                  isLoadingRates={isLoadingRates}
                  isLoadingLive={isMutating}
                  onRefreshLive={checkLive} />
               <BalancePlacementCard balances={balances} rates={rateData?.rates} />
               <BalanceChartCard balances={balances} rates={rateData?.rates} />
            </div>

            <BalanceTable
               balances={balances}
               rates={rateData?.rates}
               live={live}
               filters={filters}
               onFiltersChange={setFilters}
               onReset={() => setFilters(defaultFilters)}
               isLoading={isLoading} />

         </div>
      </KrakenLayout>
   )
}
