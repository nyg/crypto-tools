import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import useSWR, { useSWRConfig } from 'swr'
import { Loader2Icon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import InfoBanner from '../../components/lib/info-banner'
import SyncStatusStrip from '../../components/kraken/sync-status-strip'
import OrderFilters, { defaultFilters } from '../../components/kraken/order-filters'
import OrderTable from '../../components/kraken/order-table'
import { isJobRunning } from '../../components/kraken/sync-status'
import { useProvider } from '../../lib/use-settings'
import usePersistentState from '../../lib/use-persistent-state'
import { asCount } from '../../components/lib/filter-options'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

const PAGE_SIZE = 20


export default function KrakenClosedOrders() {

   const { configured, accountId, isLoading: isLoadingSettings } = useProvider('kraken')

   // ?order=… arrives from the Ledger page's Trades tab, where a fill links to the
   // order it belongs to. Read once as the initial filter, taking precedence over what
   // was remembered: after that the filter bar owns the value, and rewriting it from
   // the URL would fight with it.
   const [searchParams] = useSearchParams()
   const order = searchParams.get('order')

   const [filters, setFilters] = usePersistentState(
      'kraken.closedOrders.filters',
      defaultFilters,
      stored => order ? { ...stored, search: order } : stored)

   const [filtersKey, setFiltersKey] = useState(0)
   const [sort, setSort] = usePersistentState(
      'kraken.closedOrders.sort',
      { column: 'time', direction: 'desc' })
   const [page, setPage] = useState(0)

   const wasRunningRef = useRef(false)
   const { mutate } = useSWRConfig()

   // A sync is started on the Ledger page, but it writes the trades this page reads,
   // so the run is followed here too and the orders are revalidated when it lands.
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

   const { data: filterOptions } = useSWR(
      configured ? '/api/kraken/ledger/trades/filters' : null)

   const { data: orders, isLoading } = useSWR(
      configured ? ['/api/kraken/ledger/trades/orders', { accountId, filters, sort, page, pageSize: PAGE_SIZE }] : null,
      { keepPreviousData: true })

   if (!isLoadingSettings && !configured) {
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

            <InfoBanner>
               Every order that filled, rebuilt from the trade history stored on this machine —
               an order filled in several trades is shown once, with its total volume and the
               average price it achieved. Nothing is fetched from Kraken here; sync on the Ledger
               page to bring it up to date.
            </InfoBanner>

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
