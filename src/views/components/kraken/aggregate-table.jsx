import { useState } from 'react'
import { Link } from 'react-router'
import Big from 'big.js'
import { ChevronDownIcon, ChevronRightIcon, ChevronLeftIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { asDecimal, asNumber, asLocalTimestamp } from '../../../utils/format'
import { asCount } from '../lib/filter-options'
import { convertQuotes } from '../../lib/quote-conversion'

const sideColours = {
   buy: 'bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
   sell: 'bg-rose-600/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300'
}

const decimalsIn = (value) => (String(value).split('.')[1] ?? '').length

const decimalsOf = (values, minimum) => Math.max(minimum, ...values.map(decimalsIn))

const asAmount = (value, decimals = decimalsIn(value)) => asDecimal(Number(value), decimals)

export default function AggregateTable({ groups, market, scope, targetQuote, rateAt, isLoadingRates, hasTrades, onPageChange }) {

   const [expanded, setExpanded] = useState(() => new Set())

   const toggle = (groupKey) => setExpanded(current => {
      const next = new Set(current)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
   })

   if (!market) {
      return (
         <p className="text-sm text-muted-foreground">
            Pick a trading pair to fold its trades into runs of buying and selling.
         </p>
      )
   }

   if (!groups) return null

   const { rows, total, page, pageSize } = groups

   if (rows.length === 0) {
      return hasTrades
         ? <p className="text-sm text-muted-foreground">No trades for {scope} in this range.</p>
         : <p className="text-sm text-muted-foreground">
            No trades yet. <Link to="/kraken/ledger" className="underline underline-offset-4">Sync your ledger</Link> to
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
                  <TableHead />
                  <TableHead />
                  <TableHead />
                  <TableHead />
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Avg price</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {rows.map(group => {

                  const isExpanded = expanded.has(group.groupKey)
                  const totals = convertQuotes(group.quotes, targetQuote, rateAt, group.startTime)

                  const exact = group.quotes.length === 1 && group.quotes[0].quoteAsset === targetQuote
                     ? group.quotes[0]
                     : null

                  const pending = !exact && isLoadingRates
                  const unpriced = !exact && totals.volume.eq(0)

                  const excluded = group.quotes.filter(quote => totals.missing.includes(quote.quoteAsset))
                  const excludedVolume = excluded
                     .reduce((total, quote) => total.plus(quote.volume), Big(0))
                     .toString()

                  const title = exact ? undefined : [
                     group.quotes.map(quote => `${quote.cost} ${quote.quoteAsset}`).join(' + '),
                     totals.converted ? `converted to ${targetQuote} at today's rate` : null,
                     excluded.length > 0
                        ? `no rate for ${totals.missing.join(', ')}, leaving out ${excludedVolume} ${group.baseAsset}`
                        : null
                  ].filter(Boolean).join(' — ')

                  const amount = (key) => {
                     if (exact) return asAmount(exact[key])
                     if (pending) return '…'
                     if (unpriced) return '—'
                     const decimals = decimalsOf(group.quotes.map(quote => quote[key]), 2)
                     return `≈ ${asAmount(totals[key].toFixed(decimals), decimals)}`
                  }

                  return [
                     <TableRow key={group.groupKey}>
                        <TableCell className="whitespace-nowrap">
                           <button
                              type="button"
                              className="flex items-center gap-1 hover:text-foreground"
                              aria-expanded={isExpanded}
                              onClick={() => toggle(group.groupKey)}>
                              {isExpanded
                                 ? <ChevronDownIcon className="size-3.5 shrink-0" />
                                 : <ChevronRightIcon className="size-3.5 shrink-0" />}
                              <span>
                                 {asLocalTimestamp(group.startTime)}
                                 {group.endTime !== group.startTime && ` → ${asLocalTimestamp(group.endTime)}`}
                              </span>
                           </button>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <Badge className={cn(sideColours[group.direction])}>
                                 {group.direction || '—'}
                              </Badge>
                              {group.margin && <Badge variant="outline">margin</Badge>}
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-wrap gap-1">
                              {group.pairs.map(pair =>
                                 <Badge key={pair} variant="outline">{pair}</Badge>)}
                           </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                           <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {asCount(group.orderCount, 'order')}
                              {group.tradeCount > group.orderCount &&
                                 <Badge variant="outline">
                                    {group.tradeCount} trades
                                 </Badge>}
                           </div>
                        </TableCell>
                        <TableCell
                           className="text-right whitespace-nowrap"
                           title={excluded.length > 0 ? title : `${group.volume} ${group.baseAsset}`}>
                           {asAmount(group.volume)} <span className="text-muted-foreground">{group.baseAsset}</span>
                        </TableCell>
                        <TableCell
                           className="text-right whitespace-nowrap"
                           title={exact ? exact.price : title}>
                           {amount('price')}
                        </TableCell>
                        <TableCell
                           className="text-right whitespace-nowrap"
                           title={exact ? `${exact.cost}, ${exact.netCost} including fee` : title}>
                           {amount('cost')}
                        </TableCell>
                        <TableCell
                           className="text-right whitespace-nowrap text-muted-foreground"
                           title={exact ? exact.fee : title}>
                           {amount('fee')}
                        </TableCell>
                     </TableRow>,

                     ...(isExpanded ? group.orders.map(order =>
                        <TableRow key={`${group.groupKey} ${order.orderKey}`} className="text-muted-foreground">
                           <TableCell className="whitespace-nowrap pl-[1.4rem] text-xs">
                              {asLocalTimestamp(order.time)}
                           </TableCell>
                           <TableCell className="text-xs">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                 {order.ordertype || '—'}
                                 {order.margin && <Badge variant="outline">margin</Badge>}
                              </div>
                           </TableCell>
                           <TableCell className="whitespace-nowrap text-xs">{order.pair || '—'}</TableCell>
                           <TableCell>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                 <span className="font-mono text-xs">{order.orderId || '—'}</span>
                                 {order.tradeCount > 1 &&
                                    <Badge variant="outline" title={`Filled in ${order.tradeCount} trades`}>
                                       {order.tradeCount} trades
                                    </Badge>}
                              </div>
                           </TableCell>
                           <TableCell className="text-right text-xs" title={order.volume}>
                              {asAmount(order.volume)}
                           </TableCell>
                           <TableCell className="text-right text-xs" title={order.price}>
                              {asAmount(order.price)}
                           </TableCell>
                           <TableCell
                              className="text-right text-xs"
                              title={`${order.cost}, ${order.netCost} including fee`}>
                              {asAmount(order.cost)} {order.quoteAsset}
                           </TableCell>
                           <TableCell className="text-right text-xs" title={order.fee}>
                              {asAmount(order.fee)}
                           </TableCell>
                        </TableRow>) : [])
                  ]
               })}
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
