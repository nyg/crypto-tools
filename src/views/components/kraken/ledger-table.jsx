import { ArrowUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

// Kraken records ledger times in UTC; rendering them in the browser's zone would
// silently shift every entry.
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

export default function LedgerTable({ entries, sort, onSortChange, onPageChange, onSearchRef }) {

   const rows = entries?.rows ?? []
   const total = entries?.total ?? 0
   const { page = 0, pageSize = 50 } = entries ?? {}

   if (rows.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">
            No entries to show. Sync your ledger above, or widen the filters.
         </p>
      )
   }

   const firstRow = page * pageSize + 1
   const lastRow = Math.min(total, (page + 1) * pageSize)

   return (
      <div className="space-y-3">
         <div className="overflow-x-auto">
            <Table className="tabular-nums">
               <TableHeader>
                  <TableRow>
                     <SortableHead column="time" sort={sort} onSortChange={onSortChange}>Time (UTC)</SortableHead>
                     <SortableHead column="type" sort={sort} onSortChange={onSortChange}>Type</SortableHead>
                     <SortableHead column="asset" sort={sort} onSortChange={onSortChange}>Asset</SortableHead>
                     <SortableHead column="amount" sort={sort} onSortChange={onSortChange} className="text-right">
                        Amount
                     </SortableHead>
                     <TableHead className="text-right">Fee</TableHead>
                     <TableHead className="text-right">Balance</TableHead>
                     <TableHead>Wallet</TableHead>
                     <TableHead>Ref</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {rows.map(entry =>
                     <TableRow key={entry.txid || `${entry.refid}-${entry.time}-${entry.asset}`}>
                        <TableCell className="whitespace-nowrap">{asUtcTimestamp(entry.time)}</TableCell>
                        <TableCell>
                           <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <Badge variant="secondary">{entry.type}</Badge>
                              {entry.subtype &&
                                 <span className="text-xs text-muted-foreground">{entry.subtype}</span>}
                           </div>
                        </TableCell>
                        <TableCell
                           className="font-medium"
                           title={entry.asset !== entry.baseAsset ? entry.asset : undefined}>
                           {entry.baseAsset || entry.asset}
                        </TableCell>
                        <TableCell
                           className={cn('text-right', entry.amount.startsWith('-') ? 'text-red-600' : 'text-green-600')}>
                           {entry.amount}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{entry.fee}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                           {entry.balance || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{entry.wallet || '—'}</TableCell>
                        <TableCell>
                           {entry.refid
                              ? <button
                                 type="button"
                                 title={`Show every entry with reference ${entry.refid}`}
                                 className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                 onClick={() => onSearchRef(entry.refid)}>
                                 {entry.refid}
                              </button>
                              : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                     </TableRow>)}
               </TableBody>
            </Table>
         </div>

         <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
               Showing {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of{' '}
               {total.toLocaleString()}
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
