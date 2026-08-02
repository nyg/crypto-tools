import { useRef, useState } from 'react'
import { Link } from 'react-router'
import useSWR, { useSWRConfig } from 'swr'
import { InfoIcon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import SyncStatusStrip from '../../components/kraken/sync-status-strip'
import RewardSummaryCard from '../../components/kraken/reward-summary-card'
import RewardChartCard from '../../components/kraken/reward-chart-card'
import RewardTable from '../../components/kraken/reward-table'
import { isJobRunning } from '../../components/kraken/sync-status'
import { Alert, AlertDescription } from '@/components/ui/alert'


export default function KrakenRewards() {

   const [credentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.key')) || ''
   }))

   const wasRunningRef = useRef(false)
   const { mutate } = useSWRConfig()

   // This page reads the ledger the Ledger tab already downloaded, so the secret is
   // neither needed nor sent. The rates it fetches on top are public data.
   const account = credentials.apiKey ? { apiKey: credentials.apiKey } : null

   // A sync is started on the Ledger page but writes the rewards read here, so the run
   // is followed and the summary revalidated when it lands.
   const { data: status } = useSWR(
      account ? ['/api/kraken/ledger/sync/status', { credentials: account }] : null,
      {
         refreshInterval: latest => isJobRunning(latest?.job) ? 1500 : 0,
         onSuccess: (latest) => {
            const running = isJobRunning(latest?.job)
            if (!running && wasRunningRef.current) {
               mutate(key => Array.isArray(key) && key[0] === '/api/kraken/ledger/rewards')
            }
            wasRunningRef.current = running
         }
      })

   const { data: rewards, error, isLoading } = useSWR(
      account ? ['/api/kraken/ledger/rewards', { credentials: account }] : null,
      { keepPreviousData: true })

   // Asked for separately, and only once the assets are known, so the table renders
   // from the local database straight away and a failed rate lookup costs the amounts
   // nothing.
   const assets = (rewards?.assets ?? []).map(asset => asset.asset)
   const { data: rateData, isLoading: isLoadingRates } = useSWR(
      assets.length > 0 ? ['/api/kraken/asset-rates', { assets }] : null,
      { keepPreviousData: true })

   if (!credentials.apiKey) {
      return (
         <KrakenLayout name="Rewards">
            <Alert>
               <AlertDescription>
                  Generate an API key and secret on Kraken and add them in Settings to sync your ledger.
               </AlertDescription>
            </Alert>
         </KrakenLayout>
      )
   }

   return (
      <KrakenLayout name="Rewards">
         <div className="space-y-6">

            <div className="flex items-center gap-3 rounded-lg border border-blue-300/60 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/25 dark:bg-blue-950/30 dark:text-blue-100">
               <InfoIcon className="size-5 shrink-0" />
               <p>
                  Everything Kraken has paid you for staking and earning, per asset and per
                  year, read from the local database the Ledger tab fills. Moving coins in and
                  out of an earn position is not income and is left out. Each amount is valued
                  at today&apos;s market price, so the USD figures move with the market.
               </p>
            </div>

            {error &&
               <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
               </Alert>}

            {rewards?.entries === 0 &&
               <Alert>
                  <AlertDescription>
                     No staking or earn rewards stored yet. Sync your ledger on the{' '}
                     <Link to="/kraken/ledger" className="font-medium text-foreground underline underline-offset-4">
                        Ledger
                     </Link>{' '}
                     tab first, then come back.
                  </AlertDescription>
               </Alert>}

            <SyncStatusStrip
               state={status?.state}
               job={status?.job}
               isRunning={isJobRunning(status?.job)}
               counts={`${(status?.state?.entryCount ?? 0).toLocaleString('en-GB')} ledger entries`}
               emptyLabel="No ledger stored yet" />

            <RewardSummaryCard
               rewards={rewards}
               rates={rateData?.rates}
               isLoading={isLoading}
               isLoadingRates={isLoadingRates} />

            <RewardChartCard rewards={rewards} rates={rateData?.rates} />

            <RewardTable rewards={rewards} rates={rateData?.rates} />

         </div>
      </KrakenLayout>
   )
}
