import Big from 'big.js'
import { Loader2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { asExactDecimal, asLocalTimestamp } from '../../../utils/format'
import { asQuantity } from '../portfolio/format'
import type { InstantOrderStatus, TrackedInstantOrder } from '../../../types/api'

export interface TrackedOrder extends TrackedInstantOrder {
   replaced?: boolean
}

const statusLabels: Record<InstantOrderStatus, string> = {
   open: 'Resting',
   filled: 'Filled',
   partial: 'Partly filled',
   cancelled: 'Not filled',
   unknown: 'Checking'
}

export const remainingOf = ({ order, state }: TrackedOrder): Big =>
   Big(order.quantity).minus(state.filled)

export const isClosed = ({ state }: TrackedOrder) =>
   ['filled', 'partial', 'cancelled'].includes(state.status)

interface OrdersTableProps {
   orders: TrackedOrder[]
   busy: string | null
   onCancel: (tracked: TrackedOrder) => void
   onReprice: (tracked: TrackedOrder) => void
   onFollow: (tracked: TrackedOrder, follow: boolean) => void
   onPlaceRest: (tracked: TrackedOrder) => void
   onDismiss: (tracked: TrackedOrder) => void
}

export default function OrdersTable({ orders, busy, onCancel, onReprice, onFollow, onPlaceRest, onDismiss }: OrdersTableProps) {
   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Placed</TableHead>
               <TableHead>Pair</TableHead>
               <TableHead>Side</TableHead>
               <TableHead className="text-right">Price</TableHead>
               <TableHead className="text-right">Quantity</TableHead>
               <TableHead className="text-right">Filled</TableHead>
               <TableHead>Status</TableHead>
               <TableHead />
            </TableRow>
         </TableHeader>
         <TableBody>
            {orders.map(tracked => {
               const { order, state } = tracked
               const working = busy === order.id
               const open = !isClosed(tracked)
               return (
                  <TableRow key={order.id}>
                     <TableCell className="whitespace-nowrap">{asLocalTimestamp(order.placedAt)}</TableCell>
                     <TableCell>{order.base}/{order.quote}</TableCell>
                     <TableCell className={order.side === 'buy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                        {order.side === 'buy' ? 'Buy' : 'Sell'}
                     </TableCell>
                     <TableCell
                        className="text-right tabular-nums"
                        title={state.moves > 0 ? `Moved ${state.moves} time${state.moves === 1 ? '' : 's'}` : undefined}>
                        {asExactDecimal(state.price)}
                     </TableCell>
                     <TableCell className="text-right tabular-nums">{asQuantity(order.quantity)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asQuantity(state.filled)}</TableCell>
                     <TableCell title={state.reason || undefined}>
                        <div className="flex flex-wrap gap-1">
                           <Badge variant={state.status === 'filled' ? 'default' : state.status === 'cancelled' ? 'outline' : 'secondary'}>
                              {statusLabels[state.status]}
                           </Badge>
                           {state.following &&
                              <Badge variant="outline" title={state.bound ? `Up to ${asExactDecimal(state.bound)} ${order.quote}` : undefined}>
                                 Following
                              </Badge>}
                        </div>
                     </TableCell>
                     <TableCell className="text-right whitespace-nowrap">
                        {working && <Loader2Icon className="inline size-4 animate-spin text-muted-foreground" />}
                        {open && <>
                           <Button variant="ghost" size="sm" disabled={working} onClick={() => onFollow(tracked, !state.following)}>
                              {state.following ? 'Stop following' : 'Follow'}
                           </Button>
                           {!state.following &&
                              <Button variant="ghost" size="sm" disabled={working} onClick={() => onReprice(tracked)}>Re-price</Button>}
                           <Button variant="ghost" size="sm" disabled={working} onClick={() => onCancel(tracked)}>Cancel</Button>
                        </>}
                        {!open && !tracked.replaced && remainingOf(tracked).gt(0) &&
                           <Button variant="ghost" size="sm" disabled={working} onClick={() => onPlaceRest(tracked)}>Place the rest</Button>}
                        {!open &&
                           <Button variant="ghost" size="sm" disabled={working} onClick={() => onDismiss(tracked)}>Dismiss</Button>}
                     </TableCell>
                  </TableRow>
               )
            })}
         </TableBody>
      </Table>
   )
}
