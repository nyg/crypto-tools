import { useRef, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'
import { InfoIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import LedgerSyncCard from '../../components/kraken/ledger-sync-card'
import LedgerFilters, { defaultFilters } from '../../components/kraken/ledger-filters'
import LedgerTable from '../../components/kraken/ledger-table'
import OrderFilters, { defaultFilters as defaultTradeFilters } from '../../components/kraken/order-filters'
import TradeTable from '../../components/kraken/trade-table'
import { isJobRunning } from '../../components/kraken/sync-status'
import { asCount } from '../../components/lib/filter-options'
import { Card, CardHeader, CardAction, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

const PAGE_SIZE = 20


export default function KrakenLedger() {

   const [credentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.key')) || '',
      apiSecret: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.secret')) || ''
   }))

   // One tab per table the sync writes, so the page shows exactly what it stores.
   const [tab, setTab] = useState('entries')

   const [filters, setFilters] = useState(defaultFilters)
   const [filtersKey, setFiltersKey] = useState(0)
   const [sort, setSort] = useState({ column: 'time', direction: 'desc' })
   const [page, setPage] = useState(0)

   // The trades tab filters on different columns and sorts on its own, so it keeps its
   // own state rather than sharing the ledger's and resetting it on every switch.
   const [tradeFilters, setTradeFilters] = useState(defaultTradeFilters)
   const [tradeFiltersKey, setTradeFiltersKey] = useState(0)
   const [tradeSort, setTradeSort] = useState({ column: 'time', direction: 'desc' })
   const [tradePage, setTradePage] = useState(0)

   const [wasInterrupted, setWasInterrupted] = useState(false)

   const startedRef = useRef(false)
   const { mutate } = useSWRConfig()

   // Only the key is sent to the read endpoints: they never contact Kraken, and it
   // keeps the secret out of the SWR cache keys.
   const account = credentials.apiKey ? { apiKey: credentials.apiKey } : null

   // Everything the sync writes to, but not the sync endpoints themselves, which
   // would otherwise revalidate in a loop from the callback below.
   const refreshStoredData = () => mutate(key =>
      Array.isArray(key)
      && String(key[0]).startsWith('/api/kraken/ledger/')
      && !String(key[0]).startsWith('/api/kraken/ledger/sync'))

   // The interval is a function of the latest response, so polling stops by itself
   // as soon as the job reaches a terminal phase. Reacting to the run finishing
   // belongs here rather than in an effect: it is a response to an external event,
   // not state being synchronised.
   const { data: status } = useSWR(
      account ? ['/api/kraken/ledger/sync/status', { credentials: account }] : null,
      {
         refreshInterval: latest => isJobRunning(latest?.job) ? 1500 : 0,
         onSuccess: (latest) => {
            if (isJobRunning(latest?.job)) {
               startedRef.current = true
               setWasInterrupted(false)
               return
            }
            if (!startedRef.current) return

            startedRef.current = false
            // A job that vanished entirely means the server restarted mid-sync,
            // which is routine in development.
            if (latest && !latest.job) setWasInterrupted(true)
            refreshStoredData()
         }
      })

   const { data: filterOptions } = useSWR(
      account ? ['/api/kraken/ledger/filters', { credentials: account }] : null)

   const { data: entries, isLoading } = useSWR(
      account ? ['/api/kraken/ledger/entries', { credentials: account, filters, sort, page, pageSize: PAGE_SIZE }] : null,
      { keepPreviousData: true })

   // Fetched only once the tab is open — most visits here are to sync, not to read
   // the fills — and kept in the cache afterwards, so switching back is instant.
   const showTrades = tab === 'trades'

   const { data: tradeFilterOptions } = useSWR(
      account && showTrades ? ['/api/kraken/ledger/trades/filters', { credentials: account }] : null)

   const { data: trades, isLoading: isLoadingTrades } = useSWR(
      account && showTrades
         ? ['/api/kraken/ledger/trades/fills',
            { credentials: account, filters: tradeFilters, sort: tradeSort, page: tradePage, pageSize: PAGE_SIZE }]
         : null,
      { keepPreviousData: true })

   const { trigger: startSync, isMutating, error: syncError } = useSWRMutation('/api/kraken/ledger/sync')
   const { trigger: cancelSync } = useSWRMutation('/api/kraken/ledger/sync/cancel')
   const { trigger: clearLedger } = useSWRMutation('/api/kraken/ledger/clear')

   const job = status?.job
   const running = isJobRunning(job)

   if (!credentials.apiKey) {
      return (
         <KrakenLayout name="Ledger">
            <Alert>
               <AlertDescription>
                  Generate an API key and secret on Kraken and add them in Settings to sync your ledger.
               </AlertDescription>
            </Alert>
         </KrakenLayout>
      )
   }

   const sync = (mode) => {
      startedRef.current = true
      setWasInterrupted(false)
      startSync({ credentials, mode })
         .then(() => mutate(['/api/kraken/ledger/sync/status', { credentials: account }]))
         .catch(() => {})
   }

   // The status key is refreshed explicitly rather than through refreshStoredData,
   // which skips the sync endpoints to avoid revalidating in a loop from its own
   // callback. Without it the card keeps showing the counts of what was just deleted.
   const clear = () => clearLedger({ credentials: account })
      .then(() => Promise.all([
         refreshStoredData(),
         mutate(['/api/kraken/ledger/sync/status', { credentials: account }])
      ]))
      .catch(() => {})

   const changeFilters = (next) => {
      setFilters(next)
      setPage(0)
   }

   // Remounts the filter bar so its search box picks up the new value.
   const replaceFilters = (next) => {
      changeFilters(next)
      setFiltersKey(key => key + 1)
   }

   const changeTradeFilters = (next) => {
      setTradeFilters(next)
      setTradePage(0)
   }

   const replaceTradeFilters = (next) => {
      changeTradeFilters(next)
      setTradeFiltersKey(key => key + 1)
   }

   const isTradeFiltered = Object.keys(defaultTradeFilters)
      .some(key => tradeFilters[key] !== defaultTradeFilters[key])

   // The badge counts whatever the open tab is showing. 'entry' is spelled out rather
   // than run through asCount, which only knows how to add an s.
   const count = showTrades
      ? { isLoading: isLoadingTrades, label: asCount(trades?.total, 'trade') }
      : { isLoading, label: `${(entries?.total ?? 0).toLocaleString('en-GB')} entries` }

   return (
      <KrakenLayout name="Ledger">
         <div className="space-y-6">

            <div className="flex items-center gap-3 rounded-lg border border-blue-300/60 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/25 dark:bg-blue-950/30 dark:text-blue-100">
               <InfoIcon className="size-5 shrink-0" />
               <p>
                  Downloads two exports from Kraken — your complete ledger and your trade history —
                  and keeps both in a database on this machine, so the other tools can use them
                  without querying the API again. Kraken prepares each export in the background, so
                  a first sync can take several minutes. Nothing is uploaded anywhere.
               </p>
            </div>

            {wasInterrupted &&
               <Alert>
                  <TriangleAlertIcon />
                  <AlertDescription>
                     The sync was interrupted before it finished, most likely because the server
                     restarted. Rows saved up to that point were kept — run Sync again to fetch
                     the rest.
                  </AlertDescription>
               </Alert>}

            <LedgerSyncCard
               state={status?.state}
               job={job}
               isRunning={running}
               error={syncError}
               isStarting={isMutating}
               onSync={() => sync('incremental')}
               onFullResync={() => sync('full')}
               onCancel={() => cancelSync({ credentials: account }).catch(() => {})}
               onClear={clear} />

            <Tabs value={tab} onValueChange={setTab}>
               <Card>
                  <CardHeader>
                     <TabsList>
                        <TabsTrigger value="entries">Ledger entries</TabsTrigger>
                        <TabsTrigger value="trades">Trades</TabsTrigger>
                     </TabsList>
                     <CardAction>
                        {count.isLoading
                           ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                           : <Badge variant="outline">{count.label}</Badge>}
                     </CardAction>
                  </CardHeader>
                  <CardContent>

                     <TabsContent value="entries" className="space-y-4">
                        <LedgerFilters
                           key={filtersKey}
                           filters={filters}
                           options={filterOptions}
                           onChange={changeFilters}
                           onReset={() => replaceFilters(defaultFilters)} />
                        <LedgerTable
                           entries={entries}
                           sort={sort}
                           onSortChange={(next) => { setSort(next); setPage(0) }}
                           onPageChange={setPage}
                           onSearchRef={(refid) => replaceFilters({ ...defaultFilters, search: refid })} />
                     </TabsContent>

                     {/* The fills as Kraken exported them. Grouped into orders they are the
                         Closed Orders page; here they are what the sync actually stored. */}
                     <TabsContent value="trades" className="space-y-4">
                        <OrderFilters
                           key={tradeFiltersKey}
                           filters={tradeFilters}
                           options={tradeFilterOptions}
                           onChange={changeTradeFilters}
                           onReset={() => replaceTradeFilters(defaultTradeFilters)} />
                        <TradeTable
                           trades={trades}
                           isFiltered={isTradeFiltered}
                           sort={tradeSort}
                           onSortChange={(next) => { setTradeSort(next); setTradePage(0) }}
                           onPageChange={setTradePage}
                           onSearchId={(txid) => replaceTradeFilters({ ...defaultTradeFilters, search: txid })} />
                     </TabsContent>

                  </CardContent>
               </Card>
            </Tabs>

         </div>
      </KrakenLayout>
   )
}
