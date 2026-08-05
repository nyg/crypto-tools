import { Link } from 'react-router'
import { ArrowUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { asNumber } from '../../../utils/format'

// Kraken records trade times in UTC; rendering them in the browser's zone would
// silently shift every order.
const asUtcTimestamp = (time) => new Date(time).toISOString().replace('T', ' ').slice(0, 19)

function SortableHead({ column, sort, onSortChange, className, children }) {
   const isActive = sort.column === column
   return (
      <TableHead className={className}>
         <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => onSortChange({
               column,
               direction: isActive && sort.direction === 'desc' ? 'asc' : 'desc'
            })}>
            {children}
            <ArrowUpDownIcon className={cn('size-3', isActive ? 'opacity-100' : 'opacity-40')} />
         </button>
      </TableHead>
   )
}

export default function OrderTable({ orders, isFiltered, hasTrades, sort, onSortChange, onPageChange, onSearchOrder }) {

   const rows = orders?.rows ?? []
   const total = orders?.total ?? 0
   const { page = 0, pageSize = 50 } = orders ?? {}

   // Nothing stored at all is a different problem from a filter that matches
   // nothing, and only one of them is solved by widening the filters.
   if (rows.length === 0) {
      return hasTrades || isFiltered
         ? <p className="text-sm text-muted-foreground">No orders match these filters.</p>
         : <p className="text-sm text-muted-foreground">
            No orders yet. <Link to="/kraken/ledger" className="underline underline-offset-4">Sync your ledger</Link> to
            fetch your trade history.
         </p>
   }

   const firstRow = page * pageSize + 1
   const lastRow = Math.min(total, (page + 1) * pageSize)

   return (
      <div className="space-y-3">
         <Table className="tabular-nums">
            <TableHeader>
               <TableRow>
                  <SortableHead column="time" sort={sort} onSortChange={onSortChange}>Time (UTC)</SortableHead>
                  <SortableHead column="pair" sort={sort} onSortChange={onSortChange}>Pair</SortableHead>
                  <SortableHead column="direction" sort={sort} onSortChange={onSortChange}>Side</SortableHead>
                  <SortableHead column="ordertype" sort={sort} onSortChange={onSortChange}>Type</SortableHead>
                  <SortableHead column="volume" sort={sort} onSortChange={onSortChange} className="text-right">
                     Volume
                  </SortableHead>
                  <SortableHead column="price" sort={sort} onSortChange={onSortChange} className="text-right">
                     Price
                  </SortableHead>
                  <SortableHead column="cost" sort={sort} onSortChange={onSortChange} className="text-right">
                     Cost
                  </SortableHead>
                  <SortableHead column="fee" sort={sort} onSortChange={onSortChange} className="text-right">
                     Fee
                  </SortableHead>
                  <TableHead>Order</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {rows.map(order =>
                  <TableRow key={order.orderKey}>
                     <TableCell className="whitespace-nowrap">{asUtcTimestamp(order.time)}</TableCell>
                     <TableCell
                        className="font-medium whitespace-nowrap"
                        title={order.rawPair && order.rawPair !== order.pair ? order.rawPair : undefined}>
                        {order.pair || '—'}
                     </TableCell>
                     <TableCell>
                        <Badge variant={order.direction === 'sell' ? 'outline' : 'secondary'}>
                           {order.direction || '—'}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                           {order.ordertype || '—'}
                           {order.margin && <Badge variant="outline">margin</Badge>}
                        </div>
                     </TableCell>
                     <TableCell className="text-right">{order.volume}</TableCell>
                     <TableCell className="text-right">{order.price}</TableCell>
                     <TableCell className="text-right" title={`${order.netCost} including fee`}>
                        {order.cost}
                     </TableCell>
                     <TableCell className="text-right text-muted-foreground">{order.fee}</TableCell>
                     <TableCell>
                        <div className="flex items-center gap-2">
                           {order.orderId
                              ? <button
                                 type="button"
                                 title={`Show only order ${order.orderId}`}
                                 className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                 onClick={() => onSearchOrder(order.orderId)}>
                                 {order.orderId}
                              </button>
                              : <span className="text-muted-foreground">—</span>}
                           {order.fillCount > 1 &&
                              <Badge variant="outline" title={`Filled in ${order.fillCount} trades`}>
                                 {order.fillCount} fills
                              </Badge>}
                        </div>
                     </TableCell>
                  </TableRow>)}
            </TableBody>
         </Table>

         <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
               Showing {asNumber(firstRow)}–{asNumber(lastRow)} of{' '}
               {asNumber(total)}
            </p>
            <div className="flex items-center gap-1">
               <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label="Previous page"
                  disabled={page === 0}
                  onClick={() => onPageChange(page - 1)}>
                  <ChevronLeftIcon className="size-4" />
               </Button>
               <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label="Next page"
                  disabled={lastRow >= total}
                  onClick={() => onPageChange(page + 1)}>
                  <ChevronRightIcon className="size-4" />
               </Button>
            </div>
         </div>
      </div>
   )
}
