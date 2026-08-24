import { useEffect, useRef, useState } from 'react'
import useMutation from '../../lib/use-mutation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import Big from 'big.js'
import { Loader2Icon, RefreshCwIcon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import OpenOrderGroup from '../../components/kraken/open-order-group'
import CancelOrdersDialog from '../../components/kraken/cancel-orders-dialog'
import CredentialsAlert from '../../components/lib/credentials-alert'
import { useProvider } from '../../lib/use-settings'
import { asCount } from '../../components/lib/filter-options'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { asLocalTimestamp, asUtcTimestamp } from '../../../utils/format'
import type { OrderGroup } from '../../components/kraken/open-order-group'
import type { CancelResult, OpenOrder } from '../../../types/kraken'
import type { OpenOrdersResponse } from '../../../types/api'

// A pair's book plus what the whole book is worth, which is only used to order the
// groups on the page.
type ValuedGroup = OrderGroup & { value: Big }

const groupByPair = (orders: OpenOrder[]): ValuedGroup[] => {

   const groups = new Map<string, OrderGroup>()

   for (const order of orders) {
      const key = order.pairKey || order.rawPair || 'unknown'
      const group = groups.get(key) ?? {
         pairKey: key,
         baseAsset: order.baseAsset,
         quoteAsset: order.quoteAsset,
         orders: [] as OpenOrder[]
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

   const [selection, setSelection] = useState<Record<string, Set<string>>>({})
   const [pending, setPending] = useState<OrderGroup | null>(null)

   const { data, error, trigger: fetchOrders, isMutating } =
      useMutation<OpenOrdersResponse>('/api/kraken/open-orders')
   const { trigger: cancelOrders, isMutating: isCancelling } =
      useMutation<CancelResult, { txids: string[] }>('/api/kraken/cancel-orders')

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

   const selectionFor = (pairKey: string) => selection[pairKey] ?? new Set<string>()

   const confirmCancel = async () => {

      if (!pending) return

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

   // This page never touches the ledger, so the sub-nav's watermark would say nothing
   // about what is on screen. It shows when Kraken was last asked instead.
   const liveStatus = (
      <div className="flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
         {data?.fetchedAt &&
            <span title={`${asLocalTimestamp(data.fetchedAt)} · ${asUtcTimestamp(data.fetchedAt)} UTC`}>
               Last fetched from Kraken: {formatDistanceToNow(data.fetchedAt)} ago
            </span>}
         <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            disabled={isMutating}
            className="text-muted-foreground hover:text-foreground"
            onClick={refresh}>
            {isMutating
               ? <Loader2Icon className="size-3.5 animate-spin" />
               : <RefreshCwIcon className="size-3.5" />}
            <span className="sr-only">Refresh</span>
         </Button>
      </div>
   )

   return (
      <KrakenLayout name="Open Orders" trailing={liveStatus}>
         <div className="space-y-6">

            {Boolean(error) &&
               <Alert variant="destructive">
                  <AlertDescription>{String(error)}</AlertDescription>
               </Alert>}

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
                  lastPrice={data?.prices?.[group.pairKey]}
                  selected={selectionFor(group.pairKey)}
                  onSelectionChange={(txids) =>
                     setSelection(current => ({ ...current, [group.pairKey]: new Set(txids) }))}
                  onCancel={(orders) => setPending({ ...group, orders })} />)}

            <CancelOrdersDialog
               orders={pending?.orders ?? null}
               pairKey={pending?.pairKey ?? ''}
               baseAsset={pending?.baseAsset ?? ''}
               quoteAsset={pending?.quoteAsset ?? ''}
               isCancelling={isCancelling}
               onConfirm={confirmCancel}
               onOpenChange={() => setPending(null)} />

         </div>
      </KrakenLayout>
   )
}
