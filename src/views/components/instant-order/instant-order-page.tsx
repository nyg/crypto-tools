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
import type { FollowSettings } from './order-form'
import type { TrackedOrder } from './orders-table'
import type {
   InstantOrderActionRequest, InstantOrderActionResponse, InstantOrderFollowRequest, InstantOrderMarketsResponse,
   InstantOrderPlaceRequest, InstantOrderPlaceResponse, InstantOrderState, InstantOrderStatusResponse, TrackedInstantOrder
} from '../../../types/api'
import type { VenueId } from '../../../types/portfolio'

const STATUS_REFRESH_MS = 3000
const KEPT_ORDERS = 20

interface InstantOrderPageProps {
   layout: ExchangeLayout
   storageKey: string
   venues: [ExchangeVenue, ...ExchangeVenue[]]
}

const tracking = ({ order, state }: TrackedOrder): TrackedInstantOrder => ({ order, state })

const messageOf = (reason: unknown, fallback: string) => typeof reason === 'string' ? reason : fallback

export default function InstantOrderPage({ layout: Layout, storageKey, venues }: InstantOrderPageProps) {

   const [current, setVenueId] = useVenue(storageKey, venues)
   const { id: venue, label } = current
   const apiBase = `${current.apiRoot}/instant-orders`
   const { configured, unreachable, isLoading: isLoadingSettings } = useProvider(venue)

   const [symbols, setSymbols] = usePersistentState<Partial<Record<VenueId, string>>>('instantOrders.symbol', {})
   const [tracked, setTracked] = usePersistentState<Partial<Record<VenueId, TrackedOrder[]>>>('instantOrders.tracked', {})
   const [following, setFollowing] = usePersistentState<FollowSettings>('instantOrders.follow', { follow: true, maxMovePercent: '1' })
   const [busy, setBusy] = useState<string | null>(null)

   const orders = tracked[venue] ?? []
   const setOrders = (update: (orders: TrackedOrder[]) => TrackedOrder[]) =>
      setTracked(all => ({ ...all, [venue]: update(all[venue] ?? []).slice(0, KEPT_ORDERS) }))

   const { data: markets, error: marketsError } =
      useSWR<InstantOrderMarketsResponse>(configured ? `${apiBase}/markets` : null, { revalidateOnFocus: false })
   const { trigger: place } = useMutation<InstantOrderPlaceResponse, InstantOrderPlaceRequest>(`${apiBase}/place`)
   const { trigger: cancel } = useMutation<InstantOrderActionResponse, InstantOrderActionRequest>(`${apiBase}/cancel`)
   const { trigger: reprice } = useMutation<InstantOrderActionResponse, InstantOrderActionRequest>(`${apiBase}/reprice`)
   const { trigger: follow } = useMutation<InstantOrderActionResponse, InstantOrderFollowRequest>(`${apiBase}/follow`)

   const { mutate } = useSWRConfig()
   const refreshAccount = () => mutate(key => Array.isArray(key) && key[0] === `${apiBase}/account`)

   const settle = (id: string, state: InstantOrderState | undefined) =>
      state && setOrders(list => list.map(entry => entry.order.id === id ? { ...entry, state } : entry))

   const open = orders.filter(entry => !isClosed(entry)).map(tracking)
   useSWR<InstantOrderStatusResponse>(
      configured && open.length > 0 ? [`${apiBase}/status`, { orders: open }] : null, {
         refreshInterval: STATUS_REFRESH_MS,
         onSuccess: ({ states }) => {
            if (Object.values(states).some(({ status }) => status !== 'open' && status !== 'unknown')) refreshAccount()
            for (const [id, state] of Object.entries(states)) settle(id, state)
         }
      })

   const symbol = symbols[venue]
   const market = markets?.markets.find(entry => entry.symbol === symbol)

   const track = (entry: TrackedInstantOrder) =>
      setOrders(list => [entry, ...list])

   const act = async (entry: TrackedOrder, work: () => Promise<void>, failure: string) => {
      setBusy(entry.order.id)
      try {
         await work()
      }
      catch (reason) {
         toast.error(messageOf(reason, failure))
      }
      finally {
         setBusy(null)
      }
   }

   const cancelOrder = (entry: TrackedOrder) => act(entry, async () => {
      settle(entry.order.id, (await cancel(tracking(entry))).state)
      refreshAccount()
   }, 'The order could not be cancelled.')

   const repriceOrder = (entry: TrackedOrder) => act(entry, async () => {
      settle(entry.order.id, (await reprice(tracking(entry))).state)
   }, 'The order could not be re-priced.')

   const followOrder = (entry: TrackedOrder, on: boolean) => act(entry, async () => {
      settle(entry.order.id, (await follow({ ...tracking(entry), follow: on, maxMovePercent: following.maxMovePercent })).state)
   }, 'The order could not follow the price.')

   const placeRest = (entry: TrackedOrder) => act(entry, async () => {
      const placed = await place({
         symbol: entry.order.symbol, side: entry.order.side, unit: 'base', amount: remainingOf(entry).toFixed(), ...following
      })
      setOrders(list => [placed, ...list.map(item => item.order.id === entry.order.id ? { ...item, replaced: true } : item)])
      refreshAccount()
   }, 'The rest could not be placed.')

   const dismiss = (entry: TrackedOrder) =>
      setOrders(list => list.filter(({ order }) => order.id !== entry.order.id))

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
                        <OrderForm
                           key={`${venue}:${market.symbol}`}
                           apiBase={apiBase}
                           venueLabel={label}
                           market={market}
                           following={following}
                           onFollowingChange={setFollowing}
                           onPlaced={track} />}
                  </>}

            {orders.length > 0 &&
               <Card>
                  <CardHeader>
                     <CardTitle>Orders placed here</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <OrdersTable
                        orders={orders}
                        busy={busy}
                        onCancel={cancelOrder}
                        onReprice={repriceOrder}
                        onFollow={followOrder}
                        onPlaceRest={placeRest}
                        onDismiss={dismiss} />
                  </CardContent>
               </Card>}
         </div>
      </Layout>
   )
}
