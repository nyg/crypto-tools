import { useState } from 'react'
import { ArrowUpDownIcon, ChevronLeftIcon, ChevronRightIcon, Loader2Icon, SparklesIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { asNumber } from '../../../utils/format'

const typeLabels = {
   stock: 'Stock',
   etf: 'ETF',
   unknown: 'Unknown',
   unclassified: 'Unclassified'
}

const typeVariants = {
   stock: 'secondary',
   etf: 'default',
   unknown: 'outline',
   unclassified: 'outline'
}

const originLabels = {
   seed: 'From the checked-in reference list',
   ai: 'Classified by Claude'
}

function SortableHead({ column, sort, onSortChange, className, children }) {
   const isActive = sort.column === column
   return (
      <TableHead className={className}>
         <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => onSortChange({
               column,
               direction: isActive && sort.direction === 'asc' ? 'desc' : 'asc'
            })}>
            {children}
            <ArrowUpDownIcon className={cn('size-3', isActive ? 'opacity-100' : 'opacity-40')} />
         </button>
      </TableHead>
   )
}

export default function XStockTable({
   listings, total, isFiltered, page, pageSize, sort,
   onSortChange, onPageChange, onDescribe, describing, canDescribe
}) {

   const [expanded, setExpanded] = useState(() => new Set())

   const toggle = (ticker) => setExpanded(current => {
      const next = new Set(current)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
   })

   if (listings.length === 0) {
      return isFiltered
         ? <p className="text-sm text-muted-foreground">No listings match these filters.</p>
         : <p className="text-sm text-muted-foreground">Kraken returned no tokenized listings.</p>
   }

   const firstRow = page * pageSize + 1
   const lastRow = Math.min(total, page * pageSize + listings.length)

   return (
      <div className="space-y-3">
         <Table>
            <TableHeader>
               <TableRow>
                  <SortableHead column="altname" sort={sort} onSortChange={onSortChange}>Kraken</SortableHead>
                  <SortableHead column="ticker" sort={sort} onSortChange={onSortChange}>Ticker</SortableHead>
                  <SortableHead column="name" sort={sort} onSortChange={onSortChange}>Name</SortableHead>
                  <SortableHead column="type" sort={sort} onSortChange={onSortChange}>Type</SortableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="w-1/2">Description</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {listings.map(listing =>
                  <TableRow key={listing.ticker}>
                     <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {listing.altname}
                     </TableCell>
                     <TableCell className="font-medium whitespace-nowrap">{listing.ticker}</TableCell>
                     <TableCell>
                        {listing.name || <span className="text-muted-foreground">—</span>}
                     </TableCell>
                     <TableCell>
                        <Badge
                           variant={typeVariants[listing.type] ?? 'outline'}
                           title={originLabels[listing.origin]}>
                           {typeLabels[listing.type] ?? listing.type}
                        </Badge>
                     </TableCell>
                     <TableCell>
                        {listing.subtype
                           ? <Badge variant="outline">{listing.subtype.replace(/-/g, ' ')}</Badge>
                           : <span className="text-muted-foreground">—</span>}
                     </TableCell>
                     <TableCell className="text-sm text-muted-foreground">
                        {listing.description
                           ? <button
                              type="button"
                              className={cn('text-left leading-relaxed hover:text-foreground',
                                 !expanded.has(listing.ticker) && 'line-clamp-2')}
                              title={expanded.has(listing.ticker) ? 'Collapse' : 'Expand'}
                              onClick={() => toggle(listing.ticker)}>
                              {listing.description}
                           </button>
                           : describing.has(listing.ticker)
                              ? <Loader2Icon className="size-4 animate-spin" />
                              : <Button
                                 variant="ghost"
                                 size="sm"
                                 type="button"
                                 disabled={!canDescribe}
                                 title={canDescribe
                                    ? `Describe ${listing.ticker}`
                                    : 'Add an Anthropic API key in Settings to generate descriptions'}
                                 onClick={() => onDescribe([listing.ticker])}>
                                 <SparklesIcon className="size-3.5" />
                                 Describe
                              </Button>}
                     </TableCell>
                  </TableRow>)}
            </TableBody>
         </Table>

         <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
               Showing {asNumber(firstRow)}–{asNumber(lastRow)} of {asNumber(total)}
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
