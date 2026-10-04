import type { ComponentType, ReactNode } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import useMutation from '../../lib/use-mutation'
import usePersistentState from '../../lib/use-persistent-state'
import { useProvider } from '../../lib/use-settings'
import Checkbox from '../lib/checkbox'
import ComboboxField from '../lib/combobox-field'
import CredentialsAlert from '../lib/credentials-alert'
import Field from '../lib/field'
import LoadingSpinner from '../lib/loading-spinner'
import SelectField from '../lib/select-field'
import { asCount } from '../lib/filter-options'
import FundingChart from './funding-chart'
import FundingSyncControl, { isFundingSyncing } from './funding-sync-control'
import FundingTable from './funding-table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fundingAssets, fundingBuckets, fundingTotals } from '@/lib/funding'
import { asExactDecimal } from '../../../utils/format'
import type { FundingChartView } from './funding-chart'
import type { FundingGranularity } from '@/lib/funding'
import type { FundingCancelResponse, FundingResponse, FundingSyncResponse } from '../../../types/api'
import type { Provider } from '../../../types/credentials'

export interface FundingVenue {
   provider: Provider
   label: string
   apiBase: string
   // Whether the page fetches the history itself, or reads what another page stored.
   syncs: boolean
   setup: ReactNode
   empty: ReactNode
   note?: ReactNode
}

export type FundingLayout = ComponentType<{ children: ReactNode, name: string }>

const POLL_MS = 1500

const granularities = [
   { value: 'day', label: 'Day' },
   { value: 'month', label: 'Month' },
   { value: 'year', label: 'Year' }
]

const views = [
   { value: 'movements', label: 'Deposits and withdrawals' },
   { value: 'net', label: 'Net to date' }
]

export default function FundingPage({ layout: Layout, venue }: { layout: FundingLayout, venue: FundingVenue }) {

   const { provider, label, apiBase, syncs } = venue
   const { configured, unreachable, isLoading: isLoadingSettings } = useProvider(provider)

   const [storedAsset, setAsset] = usePersistentState<string | null>(`${provider}.funding.asset`, null)
   const [granularity, setGranularity] = usePersistentState<FundingGranularity>('funding.granularity', 'day')
   const [view, setView] = usePersistentState<FundingChartView>('funding.view', 'movements')
   const [balanceWanted, setBalanceWanted] = usePersistentState('funding.balance', true)

   const { data: funding, error, isLoading, mutate } = useSWR<FundingResponse>(
      configured ? apiBase : null,
      { refreshInterval: latest => isFundingSyncing(latest?.job) ? POLL_MS : 0 })

   const { trigger: startSync, isMutating: isStarting } = useMutation<FundingSyncResponse>(`${apiBase}/sync`)
   const { trigger: cancelSync } = useMutation<FundingCancelResponse>(`${apiBase}/sync/cancel`)

   const run = async (action: () => Promise<unknown>) => {
      try {
         await action()
         await mutate()
      }
      catch (reason) {
         toast.error(typeof reason === 'string' ? reason : `${label} could not be reached.`)
      }
   }

   if (!isLoadingSettings && (unreachable || !configured)) {
      return (
         <Layout name="Funding">
            <CredentialsAlert unreachable={unreachable}>{venue.setup}</CredentialsAlert>
         </Layout>
      )
   }

   const movements = funding?.movements ?? []
   const assets = fundingAssets(movements)

   // Derived rather than stored: an asset remembered from another account falls back to
   // the one that moved most often instead of leaving the page blank.
   const asset = assets.some(({ asset }) => asset === storedAsset) ? storedAsset! : assets[0]?.asset
   const selected = movements.filter(movement => movement.asset === asset)
   const deposits = selected.filter(({ kind }) => kind === 'deposit')
   const withdrawals = selected.filter(({ kind }) => kind === 'withdrawal')
   const totals = fundingTotals(selected)
   const hasBalances = selected.some(({ balance }) => balance !== null)

   const job = funding?.job

   const emptyText = isFundingSyncing(job)
      ? 'Nothing found yet.'
      : syncs && funding?.lastSyncedAt
         ? `No deposit or withdrawal found on ${label}.`
         : venue.empty

   return (
      <Layout name="Funding">
         <div className="flex grow flex-col gap-6">

            {Boolean(error) &&
               <Alert variant="destructive">
                  <AlertDescription>{String(error)}</AlertDescription>
               </Alert>}

            {job?.phase === 'error' &&
               <Alert variant="destructive">
                  <AlertTitle>The last sync with {label} failed</AlertTitle>
                  <AlertDescription>
                     {job.error} What was read before that is kept, and the next sync carries on from there.
                  </AlertDescription>
               </Alert>}

            {isLoading && !funding && <LoadingSpinner />}

            {funding &&
               <Card>
                  <CardHeader>
                     <CardTitle>Deposits and withdrawals</CardTitle>
                     <CardAction>
                        {syncs
                           ? <FundingSyncControl
                              job={job}
                              lastSyncedAt={funding.lastSyncedAt}
                              isStarting={isStarting}
                              onSync={() => run(startSync)}
                              onCancel={() => run(cancelSync)} />
                           : <Badge variant="outline">{asCount(movements.length, 'movement')}</Badge>}
                     </CardAction>
                  </CardHeader>

                  <CardContent className="space-y-6">

                     {!asset
                        ? <p className="text-sm text-muted-foreground">{emptyText}</p>
                        : <>
                           <div className="flex flex-wrap gap-4">
                              <ComboboxField
                                 name="funding-asset"
                                 label="Asset"
                                 className="w-40"
                                 value={asset}
                                 onValueChange={setAsset}
                                 options={assets.map(({ asset }) => ({ value: asset, label: asset }))}
                                 searchPlaceholder="Search assets…"
                                 emptyText="No asset." />
                              <SelectField
                                 name="funding-granularity"
                                 label="Group by"
                                 className="w-32"
                                 value={granularity}
                                 onValueChange={value => setGranularity(value as FundingGranularity)}
                                 options={granularities} />
                              <SelectField
                                 name="funding-view"
                                 label="Chart"
                                 className="w-56"
                                 value={view}
                                 onValueChange={value => setView(value as FundingChartView)}
                                 options={views} />
                              {hasBalances &&
                                 <Checkbox
                                    name="funding-balance"
                                    label="Balance"
                                    title={`What you held of ${asset} right after each movement, and how low and high it went in between`}
                                    className="h-8 self-end"
                                    checked={balanceWanted}
                                    onChange={event => setBalanceWanted(event.target.checked)} />}
                           </div>

                           <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                              <Field label={`Deposited · ${asCount(deposits.length, 'deposit')}`}>
                                 {asExactDecimal(totals.deposited)} {asset}
                              </Field>
                              <Field label={`Withdrawn · ${asCount(withdrawals.length, 'withdrawal')}`}>
                                 {asExactDecimal(totals.withdrawn)} {asset}
                              </Field>
                              <Field label="Net" title="Deposited less withdrawn, fees aside">
                                 <span className="font-medium">{asExactDecimal(totals.net)} {asset}</span>
                              </Field>
                              <Field label="Fees">
                                 {asExactDecimal(totals.fees)} {asset}
                              </Field>
                           </div>

                           <div className="border-t border-border pt-6">
                              <FundingChart
                                 buckets={fundingBuckets(selected, granularity)}
                                 granularity={granularity}
                                 view={view}
                                 showBalance={hasBalances && balanceWanted} />
                           </div>

                           <div className="grid gap-8 border-t border-border pt-6 lg:grid-cols-2">
                              <FundingTable kind="deposit" asset={asset} movements={deposits} />
                              <FundingTable kind="withdrawal" asset={asset} movements={withdrawals} />
                           </div>
                        </>}

                     {venue.note && <p className="text-xs text-muted-foreground">{venue.note}</p>}

                  </CardContent>
               </Card>}

         </div>
      </Layout>
   )
}
