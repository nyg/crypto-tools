import { useRef, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { Loader2Icon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import AggregateFilters, { defaultFilters } from '../../components/kraken/aggregate-filters'
import type { AggregateFilterValues } from '../../components/kraken/aggregate-filters'
import AggregateTable from '../../components/kraken/aggregate-table'
import AggregateSummary from '../../components/kraken/aggregate-summary'
import { isJobRunning } from '../../components/kraken/sync-status'
import { useProvider } from '../../lib/use-settings'
import CredentialsAlert from '../../components/lib/credentials-alert'
import SettingsLink from '../../components/lib/settings-link'
import usePersistentState from '../../lib/use-persistent-state'
import { asCount } from '../../components/lib/filter-options'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AggregationsResponse, TradeFiltersResponse } from '../../../types/api'

const PAGE_SIZE = 20


export default function KrakenAggregatedTrades() {

   const { configured, accountId, unreachable, isLoading: isLoadingSettings } = useProvider('kraken')

   const [filters, setFilters] = usePersistentState('kraken.aggregatedTrades.filters', defaultFilters)
   const [page, setPage] = useState(0)

   const wasRunningRef = useRef(false)
   const { mutate } = useSWRConfig()

   // A sync is started on the Ledger page, but it writes the trades this page reads,
   // so the run is followed here too and the groups are revalidated when it lands.
   const { data: status } = useSWR(
      configured ? '/api/kraken/ledger/sync/status' : null,
      {
         refreshInterval: latest => isJobRunning(latest?.job) ? 1500 : 0,
         onSuccess: (latest) => {
            const running = isJobRunning(latest?.job)
            if (!running && wasRunningRef.current) {
               mutate(key => String(Array.isArray(key) ? key[0] : key)
                  .startsWith('/api/kraken/ledger/trades/'))
            }
            wasRunningRef.current = running
         }
      })

   const { data: filterOptions } = useSWR<TradeFiltersResponse>(
      configured ? '/api/kraken/ledger/trades/filters' : null)

   const markets = filterOptions?.markets ?? []
   const market = markets.find(entry => entry.pairKey === filters.pairKey) ?? null
   const mergeable = !market || (filterOptions?.mergeableQuotes ?? []).includes(market.quoteAsset)
   const includeAllQuotes = filters.includeAllQuotes && mergeable

   const query = market
      ? {
         base: market.baseAsset,
         quote: market.quoteAsset,
         includeAllQuotes,
         from: filters.from,
         to: filters.to,
         order: filters.order
      }
      : null

   const { data: groups, isLoading } = useSWR<AggregationsResponse>(
      configured && query
         ? ['/api/kraken/ledger/trades/aggregations', { accountId, filters: query, page, pageSize: PAGE_SIZE }]
         : null,
      { keepPreviousData: true, refreshInterval: latest => includeAllQuotes && latest?.ratesPending ? 2000 : 0 })

   const targetQuote = groups?.quoteAsset || market?.quoteAsset || ''

   if (!isLoadingSettings && (unreachable || !configured)) {
      return (
         <KrakenLayout name="Aggregated Trades">
            <CredentialsAlert unreachable={unreachable}>
               Generate an API key and secret on Kraken and add them in <SettingsLink group="Kraken" /> to see your trades.
            </CredentialsAlert>
         </KrakenLayout>
      )
   }

   const changeFilters = (next: AggregateFilterValues) => {
      setFilters(next)
      setPage(0)
   }

   return (
      <KrakenLayout name="Aggregated Trades">
         <div className="space-y-6">

            <Card>
               <CardHeader>
                  <CardTitle>Aggregations</CardTitle>
                  <CardAction>
                     {isLoading
                        ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                        : <Badge variant="outline">{asCount(groups?.total ?? 0, 'group')}</Badge>}
                  </CardAction>
               </CardHeader>
               <CardContent className="space-y-4">
                  <AggregateFilters
                     filters={filters}
                     markets={markets}
                     mergeable={mergeable}
                     onChange={changeFilters}
                     onReset={() => changeFilters(defaultFilters)} />
                  <AggregateSummary
                     summary={groups?.summary}
                     market={market}
                     targetQuote={targetQuote}
                     ratesPending={groups?.ratesPending} />
                  <AggregateTable
                     groups={groups}
                     market={market}
                     scope={(includeAllQuotes ? market?.baseAsset : market?.label) ?? ''}
                     targetQuote={targetQuote}
                     hasTrades={(status?.state?.tradeCount ?? 0) > 0}
                     onPageChange={setPage} />
                  {groups?.truncated &&
                     <p className="text-sm text-muted-foreground">
                        Only the most recent trades of this selection were read, so the oldest
                        run may be incomplete. Narrow the date range to see all of it.
                     </p>}
               </CardContent>
            </Card>

         </div>
      </KrakenLayout>
   )
}
