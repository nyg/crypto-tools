import { useRef } from 'react'
import { Link } from 'react-router'
import useSWR, { useSWRConfig } from 'swr'
import KrakenLayout from '../../components/kraken/kraken-layout'
import RewardSummaryCard from '../../components/kraken/reward-summary-card'
import RewardChartCard from '../../components/kraken/reward-chart-card'
import RewardHistoryCard from '../../components/kraken/reward-history-card'
import RewardPeriodCard from '../../components/kraken/reward-period-card'
import RewardTable from '../../components/kraken/reward-table'
import { isJobRunning } from '../../components/kraken/sync-status'
import { useProvider } from '../../lib/use-settings'
import CredentialsAlert from '../../components/lib/credentials-alert'
import { Alert, AlertDescription } from '@/components/ui/alert'

const REWARDS_KEY = '/api/kraken/ledger/rewards'


export default function KrakenRewards() {

   const { configured, unreachable, isLoading: isLoadingSettings } = useProvider('kraken')

   const wasRunningRef = useRef(false)
   const { mutate } = useSWRConfig()

   // A sync is started on the Ledger page but writes the rewards read here, so the run
   // is followed and the summary revalidated when it lands.
   useSWR(
      configured ? '/api/kraken/ledger/sync/status' : null,
      {
         refreshInterval: latest => isJobRunning(latest?.job) ? 1500 : 0,
         onSuccess: (latest) => {
            const running = isJobRunning(latest?.job)
            if (!running && wasRunningRef.current) {
               mutate(REWARDS_KEY)
            }
            wasRunningRef.current = running
         }
      })

   const { data: rewards, error, isLoading } = useSWR(
      configured ? REWARDS_KEY : null,
      { keepPreviousData: true })

   // Asked for separately, and only once the assets are known, so the table renders
   // from the local database straight away and a failed rate lookup costs the amounts
   // nothing.
   const assets = (rewards?.assets ?? []).map(asset => asset.asset)
   const { data: rateData, isLoading: isLoadingRates } = useSWR(
      assets.length > 0 ? ['/api/kraken/asset-rates', { assets }] : null,
      { keepPreviousData: true })

   if (!isLoadingSettings && (unreachable || !configured)) {
      return (
         <KrakenLayout name="Rewards">
            <CredentialsAlert unreachable={unreachable}>
               Generate an API key and secret on Kraken and add them in Settings to sync your ledger.
            </CredentialsAlert>
         </KrakenLayout>
      )
   }

   return (
      <KrakenLayout name="Rewards">
         <div className="space-y-6">

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

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-[minmax(14rem,max-content)_repeat(3,minmax(0,1fr))]">
               <RewardSummaryCard
                  rewards={rewards}
                  rates={rateData?.rates}
                  isLoading={isLoading}
                  isLoadingRates={isLoadingRates} />
               <RewardChartCard rewards={rewards} rates={rateData?.rates} />
               <RewardHistoryCard rewards={rewards} rates={rateData?.rates} />
               <RewardPeriodCard rewards={rewards} rates={rateData?.rates} />
            </div>

            <RewardTable rewards={rewards} rates={rateData?.rates} />

         </div>
      </KrakenLayout>
   )
}
