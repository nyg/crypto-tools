import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import useSWR, { useSWRConfig } from 'swr'
import { InfoIcon, Loader2Icon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import SyncStatusStrip from '../../components/kraken/sync-status-strip'
import OrderFilters, { defaultFilters } from '../../components/kraken/order-filters'
import OrderTable from '../../components/kraken/order-table'
import { isJobRunning } from '../../components/kraken/sync-status'
import { asCount } from '../../components/lib/filter-options'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

const PAGE_SIZE = 20


export default function KrakenClosedOrders() {

   const [credentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.key')) || ''
   }))

   // ?order=… arrives from the Ledger page's Trades tab, where a fill links to the
   // order it belongs to. Read once as the initial filter: after that the filter bar
   // owns the value, and rewriting it from the URL would fight with it.
   const [searchParams] = useSearchParams()
   const [filters, setFilters] = useState(() => {
      const order = searchParams.get('order')
      return order ? { ...defaultFilters, search: order } : defaultFilters
   })

   const [filtersKey, setFiltersKey] = useState(0)
   const [sort, setSort] = useState({ column: 'time', direction: 'desc' })
   const [page, setPage] = useState(0)

   const wasRunningRef = useRef(false)
   const { mutate } = useSWRConfig()

   // Only the key is sent: these endpoints never contact Kraken, and it keeps the
   // secret out of the SWR cache keys.
   const account = credentials.apiKey ? { apiKey: credentials.apiKey } : null

   // A sync is started on the Ledger page, but it writes the trades this page reads,
   // so the run is followed here too and the orders are revalidated when it lands.
   const { data: status } = useSWR(
      account ? ['/api/kraken/ledger/sync/status', { credentials: account }] : null,
      {
         refreshInterval: latest => isJobRunning(latest?.job) ? 1500 : 0,
         onSuccess: (latest) => {
            const running = isJobRunning(latest?.job)
            if (!running && wasRunningRef.current) {
               mutate(key => Array.isArray(key)
                  && String(key[0]).startsWith('/api/kraken/ledger/trades/'))
            }
            wasRunningRef.current = running
         }
      })

   const { data: filterOptions } = useSWR(
      account ? ['/api/kraken/ledger/trades/filters', { credentials: account }] : null)

   const { data: orders, isLoading } = useSWR(
      account ? ['/api/kraken/ledger/trades/orders', { credentials: account, filters, sort, page, pageSize: PAGE_SIZE }] : null,
      { keepPreviousData: true })

   if (!credentials.apiKey) {
      return (
         <KrakenLayout name="Closed Orders">
            <Alert>
               <AlertDescription>
                  Generate an API key and secret on Kraken and add them in Settings to see your orders.
               </AlertDescription>
            </Alert>
         </KrakenLayout>
      )
   }

   const changeFilters = (next) => {
      setFilters(next)
      setPage(0)
   }

   // Remounts the filter bar so its search box picks up the new value.
   const replaceFilters = (next) => {
      changeFilters(next)
      setFiltersKey(key => key + 1)
   }

   const isFiltered = Object.keys(defaultFilters).some(key => filters[key] !== defaultFilters[key])

   return (
      <KrakenLayout name="Closed Orders">
         <div className="space-y-6">

            <div className="flex items-center gap-3 rounded-lg border border-blue-300/60 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/25 dark:bg-blue-950/30 dark:text-blue-100">
               <InfoIcon className="size-5 shrink-0" />
               <p>
                  Every order that filled, rebuilt from the trade history stored on this machine —
                  an order filled in several trades is shown once, with its total volume and the
                  average price it achieved. Nothing is fetched from Kraken here; sync on the Ledger
                  page to bring it up to date.
               </p>
            </div>

            <SyncStatusStrip
               state={status?.state}
               job={status?.job}
               isRunning={isJobRunning(status?.job)} />

            <Card>
               <CardHeader>
                  <CardTitle>Orders</CardTitle>
                  <CardAction>
                     {isLoading
                        ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                        : <Badge variant="outline">{asCount(orders?.total, 'order')}</Badge>}
                  </CardAction>
               </CardHeader>
               <CardContent className="space-y-4">
                  <OrderFilters
                     key={filtersKey}
                     filters={filters}
                     options={filterOptions}
                     onChange={changeFilters}
                     onReset={() => replaceFilters(defaultFilters)} />
                  <OrderTable
                     orders={orders}
                     isFiltered={isFiltered}
                     hasTrades={(status?.state?.tradeCount ?? 0) > 0}
                     sort={sort}
                     onSortChange={(next) => { setSort(next); setPage(0) }}
                     onPageChange={setPage}
                     onSearchOrder={(orderId) => replaceFilters({ ...defaultFilters, search: orderId })} />
               </CardContent>
            </Card>

         </div>
      </KrakenLayout>
   )
}
