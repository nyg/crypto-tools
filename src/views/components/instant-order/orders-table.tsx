import Big from 'big.js'
import { Loader2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { asExactDecimal, asLocalTimestamp } from '../../../utils/format'
import { asQuantity } from '../portfolio/format'
import type { InstantOrder, InstantOrderState, InstantOrderStatus } from '../../../types/api'

export interface TrackedOrder {
   order: InstantOrder
   state: InstantOrderState | null
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
   Big(order.quantity).minus(state?.filled ?? 0)

export const isClosed = ({ state }: TrackedOrder) =>
   state !== null && ['filled', 'partial', 'cancelled'].includes(state.status)

interface OrdersTableProps {
   orders: TrackedOrder[]
   busy: string | null
   onCancel: (tracked: TrackedOrder) => void
   onReplace: (tracked: TrackedOrder) => void
   onDismiss: (tracked: TrackedOrder) => void
}

export default function OrdersTable({ orders, busy, onCancel, onReplace, onDismiss }: OrdersTableProps) {
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
               const status = state?.status ?? 'unknown'
               const working = busy === order.clientOrderId
               const left = !tracked.replaced && remainingOf(tracked).gt(0)
               return (
                  <TableRow key={order.clientOrderId}>
                     <TableCell className="whitespace-nowrap">{asLocalTimestamp(order.placedAt)}</TableCell>
                     <TableCell>{order.base}/{order.quote}</TableCell>
                     <TableCell className={order.side === 'buy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                        {order.side === 'buy' ? 'Buy' : 'Sell'}
                     </TableCell>
                     <TableCell className="text-right tabular-nums">{asExactDecimal(order.price)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asQuantity(order.quantity)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asQuantity(state?.filled ?? '0')}</TableCell>
                     <TableCell title={state?.reason || undefined}>
                        <Badge variant={status === 'filled' ? 'default' : status === 'cancelled' ? 'outline' : 'secondary'}>
                           {statusLabels[status]}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-right whitespace-nowrap">
                        {working && <Loader2Icon className="inline size-4 animate-spin text-muted-foreground" />}
                        {status === 'open' && <>
                           <Button variant="ghost" size="sm" disabled={working} onClick={() => onReplace(tracked)}>Re-price</Button>
                           <Button variant="ghost" size="sm" disabled={working} onClick={() => onCancel(tracked)}>Cancel</Button>
                        </>}
                        {isClosed(tracked) && left &&
                           <Button variant="ghost" size="sm" disabled={working} onClick={() => onReplace(tracked)}>Place the rest</Button>}
                        {isClosed(tracked) &&
                           <Button variant="ghost" size="sm" disabled={working} onClick={() => onDismiss(tracked)}>Dismiss</Button>}
                     </TableCell>
                  </TableRow>
               )
            })}
         </TableBody>
      </Table>
   )
}
