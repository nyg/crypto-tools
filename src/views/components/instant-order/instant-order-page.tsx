import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import useMutation from '../../lib/use-mutation'
import usePersistentState from '../../lib/use-persistent-state'
import { useProvider } from '../../lib/use-settings'
import ComboboxField from '../lib/combobox-field'
import CredentialsAlert from '../lib/credentials-alert'
import LoadingSpinner from '../lib/loading-spinner'
import VenueTabs, { useVenue } from '../lib/venue-tabs'
import OrderForm from './order-form'
import OrdersTable, { isClosed, remainingOf } from './orders-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExchangeLayout, ExchangeVenue } from '../lib/venue-tabs'
import type { TrackedOrder } from './orders-table'
import type {
   InstantOrder, InstantOrderCancelRequest, InstantOrderCancelResponse, InstantOrderMarketsResponse,
   InstantOrderPlaceRequest, InstantOrderPlaceResponse, InstantOrderState, InstantOrderStatusResponse
} from '../../../types/api'
import type { VenueId } from '../../../types/portfolio'

const STATUS_REFRESH_MS = 5000
const UNKNOWN_FOR_MS = 5 * 60 * 1000
const KEPT_ORDERS = 20

interface InstantOrderPageProps {
   layout: ExchangeLayout
   storageKey: string
   venues: [ExchangeVenue, ...ExchangeVenue[]]
}

const lookupOf = ({ symbol, clientOrderId, orderId }: InstantOrder) => ({ symbol, clientOrderId, orderId })

const needsChecking = ({ order, state }: TrackedOrder) =>
   state?.status === 'open' || (!state || state.status === 'unknown') && Date.now() - order.placedAt < UNKNOWN_FOR_MS

const messageOf = (reason: unknown, fallback: string) => typeof reason === 'string' ? reason : fallback

export default function InstantOrderPage({ layout: Layout, storageKey, venues }: InstantOrderPageProps) {

   const [current, setVenueId] = useVenue(storageKey, venues)
   const { id: venue, label } = current
   const apiBase = `${current.apiRoot}/instant-orders`
   const { configured, unreachable, isLoading: isLoadingSettings } = useProvider(venue)

   const [symbols, setSymbols] = usePersistentState<Partial<Record<VenueId, string>>>('instantOrders.symbol', {})
   const [tracked, setTracked] = usePersistentState<Partial<Record<VenueId, TrackedOrder[]>>>('instantOrders.orders', {})
   const [busy, setBusy] = useState<string | null>(null)

   const orders = tracked[venue] ?? []
   const setOrders = (update: (orders: TrackedOrder[]) => TrackedOrder[]) =>
      setTracked(all => ({ ...all, [venue]: update(all[venue] ?? []).slice(0, KEPT_ORDERS) }))

   const { data: markets, error: marketsError } =
      useSWR<InstantOrderMarketsResponse>(configured ? `${apiBase}/markets` : null, { revalidateOnFocus: false })
   const { trigger: place } = useMutation<InstantOrderPlaceResponse, InstantOrderPlaceRequest>(`${apiBase}/place`)
   const { trigger: cancel } = useMutation<InstantOrderCancelResponse, InstantOrderCancelRequest>(`${apiBase}/cancel`)

   const { mutate } = useSWRConfig()
   const refreshAccount = () => mutate(key => Array.isArray(key) && key[0] === `${apiBase}/account`)

   const checking = orders.filter(needsChecking).map(({ order }) => lookupOf(order))
   useSWR<InstantOrderStatusResponse>(
      configured && checking.length > 0 ? [`${apiBase}/status`, { orders: checking }] : null, {
         refreshInterval: STATUS_REFRESH_MS,
         onSuccess: ({ states }) => {
            if (Object.values(states).some(({ status }) => status !== 'open' && status !== 'unknown')) refreshAccount()
            setOrders(list => list.map(entry => withState(entry, states[entry.order.clientOrderId])))
         }
      })

   const symbol = symbols[venue]
   const market = markets?.markets.find(entry => entry.symbol === symbol)

   const track = (order: InstantOrder) =>
      setOrders(list => [{ order, state: null }, ...list])

   const settle = (clientOrderId: string, state: InstantOrderState) =>
      setOrders(list => list.map(entry => entry.order.clientOrderId === clientOrderId ? withState(entry, state) : entry))

   const act = async (entry: TrackedOrder, work: () => Promise<void>) => {
      setBusy(entry.order.clientOrderId)
      try {
         await work()
      }
      finally {
         setBusy(null)
      }
   }

   const cancelOrder = (entry: TrackedOrder) => act(entry, async () => {
      try {
         settle(entry.order.clientOrderId, (await cancel({ order: lookupOf(entry.order) })).state)
         refreshAccount()
      }
      catch (reason) {
         toast.error(messageOf(reason, 'The order could not be cancelled.'))
      }
   })

   const replace = (entry: TrackedOrder) => act(entry, async () => {
      try {
         let latest = entry
         if (!isClosed(entry)) {
            const { state } = await cancel({ order: lookupOf(entry.order) })
            settle(entry.order.clientOrderId, state)
            latest = withState(entry, state)
            if (!isClosed(latest)) {
               toast.error(`${label} has not closed the order yet: try again in a moment.`)
               return
            }
         }
         const rest = remainingOf(latest)
         if (rest.lte(0)) return
         const { order } = await place({ symbol: entry.order.symbol, side: entry.order.side, unit: 'base', amount: rest.toFixed() })
         setOrders(list => [
            { order, state: null },
            ...list.map(item => item.order.clientOrderId === entry.order.clientOrderId ? { ...item, replaced: true } : item)
         ])
         refreshAccount()
      }
      catch (reason) {
         toast.error(messageOf(reason, 'The order could not be placed again.'))
      }
   })

   const dismiss = (entry: TrackedOrder) =>
      setOrders(list => list.filter(({ order }) => order.clientOrderId !== entry.order.clientOrderId))

   const venueTabs = <VenueTabs venues={venues} value={venue} onValueChange={setVenueId} />

   if (!isLoadingSettings && (unreachable || !configured)) {
      return (
         <Layout name="Instant Limit Order">
            <div className="space-y-4">
               {venueTabs}
               <CredentialsAlert unreachable={unreachable}>{current.setup}</CredentialsAlert>
            </div>
         </Layout>
      )
   }

   return (
      <Layout name="Instant Limit Order">
         <div className="flex grow flex-col gap-6">
            {venueTabs}

            {marketsError
               ? <Alert variant="destructive">
                  <AlertDescription>{messageOf(marketsError, `The ${label} markets could not be read.`)}</AlertDescription>
               </Alert>
               : !markets
                  ? <LoadingSpinner />
                  : <>
                     <ComboboxField
                        name="instant-pair"
                        label="Pair"
                        className="max-w-sm"
                        value={symbol}
                        placeholder="Pick a spot pair…"
                        searchPlaceholder="BTC, ETH/USDT…"
                        onValueChange={value => setSymbols(all => ({ ...all, [venue]: value }))}
                        options={markets.markets.map(({ symbol, base, quote }) => ({ value: symbol, label: `${base}/${quote}` }))} />

                     {market &&
                        <OrderForm key={`${venue}:${market.symbol}`} apiBase={apiBase} venueLabel={label} market={market} onPlaced={track} />}
                  </>}

            {orders.length > 0 &&
               <Card>
                  <CardHeader>
                     <CardTitle>Orders placed here</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <OrdersTable orders={orders} busy={busy} onCancel={cancelOrder} onReplace={replace} onDismiss={dismiss} />
                  </CardContent>
               </Card>}
         </div>
      </Layout>
   )
}

function withState(entry: TrackedOrder, state: InstantOrderState | undefined): TrackedOrder {
   if (!state) return entry
   if (state.status === 'unknown' && entry.state && entry.state.status !== 'unknown') return entry
   return { ...entry, order: { ...entry.order, orderId: entry.order.orderId ?? state.orderId }, state }
}
