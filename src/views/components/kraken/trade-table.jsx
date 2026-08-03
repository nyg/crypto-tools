import { Link } from 'react-router'
import { ArrowUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

// Kraken records trade times in UTC; rendering them in the browser's zone would
// silently shift every fill.
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

// One row per fill, exactly as the trades export wrote it. Orders — several fills
// folded into one — are what the Closed Orders page shows; this is the stored data
// behind it, next to the ledger entries the same sync downloaded.
export default function TradeTable({ trades, isFiltered, sort, onSortChange, onPageChange, onSearchId }) {

   const rows = trades?.rows ?? []
   const total = trades?.total ?? 0
   const { page = 0, pageSize = 50 } = trades ?? {}

   if (rows.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">
            {isFiltered
               ? 'No trades match these filters.'
               : 'No trades stored. Sync above to fetch your trade history.'}
         </p>
      )
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
                  <TableHead>Trade</TableHead>
                  <TableHead>Order</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {rows.map(trade =>
                  <TableRow key={trade.txid}>
                     <TableCell className="whitespace-nowrap">{asUtcTimestamp(trade.time)}</TableCell>
                     <TableCell
                        className="font-medium whitespace-nowrap"
                        title={trade.rawPair && trade.rawPair !== trade.pair ? trade.rawPair : undefined}>
                        {trade.pair || '—'}
                     </TableCell>
                     <TableCell>
                        <Badge variant={trade.direction === 'sell' ? 'outline' : 'secondary'}>
                           {trade.direction || '—'}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                           {trade.ordertype || '—'}
                           {Number(trade.margin) !== 0 && <Badge variant="outline">margin</Badge>}
                        </div>
                     </TableCell>
                     <TableCell className="text-right">{trade.volume}</TableCell>
                     <TableCell className="text-right">{trade.price}</TableCell>
                     <TableCell className="text-right">{trade.cost}</TableCell>
                     <TableCell className="text-right text-muted-foreground">{trade.fee}</TableCell>
                     <TableCell>
                        <button
                           type="button"
                           title={`Show only ${trade.txid}`}
                           className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                           onClick={() => onSearchId(trade.txid)}>
                           {trade.txid}
                        </button>
                     </TableCell>
                     <TableCell>
                        {/* The order id is the one thing this table has that the ledger
                            export does not, so it links to where it is put to use. */}
                        {trade.orderId
                           ? <Link
                              to={`/kraken/closed-orders?order=${encodeURIComponent(trade.orderId)}`}
                              title={`Show order ${trade.orderId} in Closed Orders`}
                              className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                              {trade.orderId}
                           </Link>
                           : <span className="text-muted-foreground">—</span>}
                     </TableCell>
                  </TableRow>)}
            </TableBody>
         </Table>

         <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
               Showing {firstRow.toLocaleString('en-GB')}–{lastRow.toLocaleString('en-GB')} of{' '}
               {total.toLocaleString('en-GB')}
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
