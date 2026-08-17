import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import useSWRMutation from 'swr/mutation'
import { toast } from 'sonner'
import Big from 'big.js'
import { Loader2Icon, RefreshCwIcon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import InfoBanner from '../../components/lib/info-banner'
import OpenOrderGroup from '../../components/kraken/open-order-group'
import CancelOrdersDialog from '../../components/kraken/cancel-orders-dialog'
import CredentialsAlert from '../../components/lib/credentials-alert'
import { useProvider } from '../../lib/use-settings'
import { asCount } from '../../components/lib/filter-options'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { asLocalTimestamp, asUtcTimestamp } from '../../../utils/format'

const groupByPair = (orders) => {

   const groups = new Map()

   for (const order of orders) {
      const key = order.pairKey || order.rawPair || 'unknown'
      const group = groups.get(key) ?? {
         pairKey: key,
         baseAsset: order.baseAsset,
         quoteAsset: order.quoteAsset,
         orders: []
      }
      group.orders.push(order)
      groups.set(key, group)
   }

   return [...groups.values()]
      .map(group => ({
         ...group,
         value: group.orders.reduce((sum, order) => sum.plus(order.value), Big(0))
      }))
      .toSorted((a, b) => b.value.cmp(a.value) || a.pairKey.localeCompare(b.pairKey))
}


export default function KrakenOpenOrders() {

   const { configured, unreachable, isLoading: isLoadingSettings } = useProvider('kraken')

   const [selection, setSelection] = useState({})
   const [pending, setPending] = useState(null)

   const { data, error, trigger: fetchOrders, isMutating } = useSWRMutation('/api/kraken/open-orders')
   const { trigger: cancelOrders, isMutating: isCancelling } = useSWRMutation('/api/kraken/cancel-orders')

   const refresh = () => fetchOrders().catch(() => {})

   const hasFetchedRef = useRef(false)

   useEffect(() => {
      if (!configured || hasFetchedRef.current) return
      hasFetchedRef.current = true
      refresh()
   }, [configured])

   if (!isLoadingSettings && (unreachable || !configured)) {
      return (
         <KrakenLayout name="Open Orders">
            <CredentialsAlert unreachable={unreachable}>
               Generate an API key and secret on Kraken and add them in Settings to see and manage your open orders.
            </CredentialsAlert>
         </KrakenLayout>
      )
   }

   const groups = groupByPair(data?.orders ?? [])

   const selectionFor = pairKey => selection[pairKey] ?? new Set()

   const confirmCancel = async () => {

      const txids = pending.orders.map(order => order.txid)

      try {
         const result = await cancelOrders({ txids })
         toast.success(`${asCount(result?.count ?? txids.length, 'order')} cancelled.`)
         setSelection(current => ({ ...current, [pending.pairKey]: new Set() }))
         setPending(null)
         await refresh()
      }
      catch (reason) {
         toast.error(typeof reason === 'string' ? reason : 'Those orders could not be cancelled.')
      }
   }

   return (
      <KrakenLayout name="Open Orders">
         <div className="space-y-6">

            <InfoBanner>
               Every order still sitting on Kraken&apos;s book, read live from the exchange rather
               than from the local ledger — which only ever learns about an order once it has
               filled. Orders are grouped by trading pair, each table footing with the total and
               the per-order average of what it holds, and can be cancelled one at a time or
               several at once.{' '}
               <Link to="/kraken/order-batch" className="underline underline-offset-4">Order Batch</Link>{' '}
               is where new ones are created.
            </InfoBanner>

            {error &&
               <Alert variant="destructive">
                  <AlertDescription>{String(error)}</AlertDescription>
               </Alert>}

            <div className="flex items-center gap-3">
               <Button variant="outline" size="sm" type="button" disabled={isMutating} onClick={refresh}>
                  {isMutating
                     ? <Loader2Icon className="size-4 animate-spin" />
                     : <RefreshCwIcon className="size-4" />}
                  Refresh
               </Button>
               {data?.fetchedAt &&
                  <p className="text-sm text-muted-foreground" title={`${asUtcTimestamp(data.fetchedAt)} UTC`}>
                     Read from Kraken at {asLocalTimestamp(data.fetchedAt)}
                  </p>}
            </div>

            {!isMutating && data && groups.length === 0 &&
               <Alert>
                  <AlertDescription>
                     No open orders on Kraken right now.
                  </AlertDescription>
               </Alert>}

            {groups.map(group =>
               <OpenOrderGroup
                  key={group.pairKey}
                  group={group}
                  lastPrice={data?.prices?.[group.pairKey] ?? null}
                  selected={selectionFor(group.pairKey)}
                  onSelectionChange={(txids) =>
                     setSelection(current => ({ ...current, [group.pairKey]: new Set(txids) }))}
                  onCancel={(orders) => setPending({ ...group, orders })} />)}

            <CancelOrdersDialog
               orders={pending?.orders ?? null}
               pairKey={pending?.pairKey}
               baseAsset={pending?.baseAsset}
               quoteAsset={pending?.quoteAsset}
               isCancelling={isCancelling}
               onConfirm={confirmCancel}
               onOpenChange={() => setPending(null)} />

         </div>
      </KrakenLayout>
   )
}
