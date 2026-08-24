import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { summarize } from './open-order-totals'
import { asCount } from '../lib/filter-options'
import { asAssetAmount, asLocalTimestamp, asNumber, asPercentage, asUtcTimestamp } from '../../../utils/format'
import type Big from 'big.js'
import type { OpenOrder } from '../../../types/kraken'

// One trading pair's book, which is how the page groups what Kraken returned.
export interface OrderGroup {
   pairKey: string
   baseAsset: string
   quoteAsset: string
   orders: OpenOrder[]
}

const PAGE_SIZES = [10, 25, 50]

const sideOptions = (orders: OpenOrder[]) => [
   { value: '', label: 'All', count: orders.length },
   { value: 'buy', label: 'Buy', count: orders.filter(order => order.type === 'buy').length },
   { value: 'sell', label: 'Sell', count: orders.filter(order => order.type === 'sell').length }
]

const sideColours: Record<string, string> = {
   buy: 'bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
   sell: 'bg-rose-600/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300'
}

const distanceFrom = (order: OpenOrder, lastPrice: number | undefined) =>
   lastPrice == null || lastPrice === 0 ? null : (Number(order.price) - lastPrice) / lastPrice

// Handed either a raw string off an order or a Big from the totals, both of which
// Number() reads the same way.
const amountOf = (value: string | number | Big | null | undefined, asset: string) =>
   value == null ? '—' : `${asAssetAmount(Number(value))} ${asset}`

export default function OpenOrderGroup({
   group, lastPrice, selected, onSelectionChange, onCancel
}: {
   group: OrderGroup
   lastPrice?: number
   selected: Set<string>
   onSelectionChange: (txids: string[]) => void
   onCancel: (orders: OpenOrder[]) => void
}) {

   const [page, setPage] = useState(0)
   const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
   const [side, setSide] = useState('')

   const { orders, pairKey, baseAsset, quoteAsset } = group

   const hasBothSides = orders.some(order => order.type === 'buy') && orders.some(order => order.type === 'sell')
   const shown = hasBothSides && side ? orders.filter(order => order.type === side) : orders

   const totals = summarize(shown)

   const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
   const currentPage = Math.min(page, pageCount - 1)
   const rows = shown.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

   const selectedOrders = shown.filter(order => selected.has(order.txid))
   const allSelected = selectedOrders.length === shown.length && shown.length > 0

   const toggleAll = () => onSelectionChange(allSelected ? [] : shown.map(order => order.txid))

   const toggleOne = (txid: string) => {
      const next = new Set(selected)
      if (!next.delete(txid)) next.add(txid)
      onSelectionChange([...next])
   }

   const changePageSize = (size: number) => {
      setPageSize(size)
      setPage(0)
   }

   const changeSide = (value: string) => {
      setSide(value)
      setPage(0)
      onSelectionChange([])
   }

   const firstRow = currentPage * pageSize + 1
   const lastRow = Math.min(shown.length, (currentPage + 1) * pageSize)

   return (
      <Card size="sm">
         <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
               {pairKey || 'Unknown pair'}
               <Badge variant="outline">{asCount(orders.length, 'order')}</Badge>
               <span className="text-sm font-normal text-muted-foreground">
                  {lastPrice == null
                     ? 'no ticker for this pair'
                     : `last price: ${amountOf(lastPrice, quoteAsset)}`}
               </span>
            </CardTitle>
            <CardAction className="flex items-center gap-2">
               {selectedOrders.length > 0 &&
                  <>
                     <span className="text-sm text-muted-foreground">
                        {asNumber(selectedOrders.length)} selected
                     </span>
                     <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        onClick={() => onCancel(selectedOrders)}>
                        Cancel selected
                     </Button>
                  </>}
            </CardAction>
         </CardHeader>
         <CardContent className="space-y-2">

            {hasBothSides &&
               <div className="flex items-center gap-1">
                  {sideOptions(orders).map(option =>
                     <Button
                        key={option.value}
                        variant={option.value === side ? 'secondary' : 'ghost'}
                        size="xs"
                        type="button"
                        aria-pressed={option.value === side}
                        onClick={() => changeSide(option.value)}>
                        {option.label}
                        <span className="text-muted-foreground">{option.count}</span>
                     </Button>)}
               </div>}

            <Table className="text-xs tabular-nums [&_td]:px-2 [&_td]:py-1 [&_th]:h-7 [&_th]:px-2">
               <TableHeader>
                  <TableRow>
                     <TableHead className="w-8">
                        <Checkbox
                           checked={allSelected}
                           aria-label={`Select every ${pairKey} order shown`}
                           onCheckedChange={toggleAll} />
                     </TableHead>
                     <TableHead />
                     <TableHead>Reference</TableHead>
                     <TableHead className="text-right">Volume</TableHead>
                     <TableHead className="text-right">Price</TableHead>
                     <TableHead className="text-right">Cost</TableHead>
                     <TableHead className="text-right">To market</TableHead>
                     <TableHead>Opened</TableHead>
                     <TableHead>Order</TableHead>
                     <TableHead className="w-8" />
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {rows.map(order => {

                     const distance = distanceFrom(order, lastPrice)
                     const isPartial = Number(order.executed) > 0

                     return (
                        <TableRow key={order.txid} data-state={selected.has(order.txid) ? 'selected' : undefined}>
                           <TableCell>
                              <Checkbox
                                 checked={selected.has(order.txid)}
                                 aria-label={`Select order ${order.txid}`}
                                 onCheckedChange={() => toggleOne(order.txid)} />
                           </TableCell>
                           <TableCell>
                              <Badge className={cn('gap-1.5', sideColours[order.type])}>
                                 {order.type || '—'}
                                 <span className="font-normal opacity-70">{order.ordertype || '—'}</span>
                              </Badge>
                           </TableCell>
                           <TableCell className="font-mono text-xs">
                              {order.reference == null || order.reference === 0
                                 ? <span className="text-muted-foreground">—</span>
                                 : order.reference}
                           </TableCell>
                           <TableCell
                              className="text-right"
                              title={isPartial ? `${order.executed} of ${order.volume} already filled` : `${order.volume} ${baseAsset}`}>
                              {asAssetAmount(Number(order.remaining))}
                              {isPartial &&
                                 <span className="ml-1 text-xs text-muted-foreground">
                                    of {asAssetAmount(Number(order.volume))}
                                 </span>}
                           </TableCell>
                           <TableCell className="text-right" title={`${order.price} ${quoteAsset}`}>
                              {asAssetAmount(Number(order.price))}
                           </TableCell>
                           <TableCell className="text-right" title={`${order.value} ${quoteAsset}`}>
                              {asAssetAmount(Number(order.value))}
                           </TableCell>
                           <TableCell
                              className={cn('text-right', distance == null && 'text-muted-foreground')}
                              title={distance == null
                                 ? 'No ticker for this pair'
                                 : `The market has to move ${asPercentage(Math.abs(distance))} ${distance < 0 ? 'down' : 'up'} to fill this order`}>
                              {distance == null ? '—' : asPercentage(distance)}
                           </TableCell>
                           <TableCell
                              className="whitespace-nowrap text-muted-foreground"
                              title={`${asUtcTimestamp(order.opened)} UTC`}>
                              {asLocalTimestamp(order.opened)}
                           </TableCell>
                           <TableCell className="font-mono text-xs text-muted-foreground">{order.txid}</TableCell>
                           <TableCell>
                              <Button
                                 variant="ghost"
                                 size="icon-xs"
                                 type="button"
                                 aria-label={`Cancel order ${order.txid}`}
                                 title="Cancel this order"
                                 onClick={() => onCancel([order])}>
                                 <Trash2Icon className="size-3.5" />
                              </Button>
                           </TableCell>
                        </TableRow>
                     )
                  })}
               </TableBody>
               <TableFooter>
                  <TableRow>
                     <TableCell colSpan={3}>Total</TableCell>
                     <TableCell className="text-right" title={`${totals.volume.toFixed()} ${baseAsset}`}>
                        {amountOf(totals.volume, baseAsset)}
                     </TableCell>
                     <TableCell />
                     <TableCell className="text-right" title={`${totals.value.toFixed()} ${quoteAsset}`}>
                        {amountOf(totals.value, quoteAsset)}
                     </TableCell>
                     <TableCell colSpan={4} className="text-right text-xs font-normal text-muted-foreground">
                        over {asCount(totals.count, 'order')}
                     </TableCell>
                  </TableRow>
                  <TableRow className="font-normal text-muted-foreground">
                     <TableCell colSpan={3}>Average per order</TableCell>
                     <TableCell className="text-right">{amountOf(totals.averageVolume, baseAsset)}</TableCell>
                     <TableCell
                        className="text-right"
                        title={totals.weightedPrice
                           ? `${asAssetAmount(Number(totals.weightedPrice))} ${quoteAsset} weighted by volume`
                           : undefined}>
                        {amountOf(totals.averagePrice, quoteAsset)}
                     </TableCell>
                     <TableCell className="text-right">{amountOf(totals.averageValue, quoteAsset)}</TableCell>
                     <TableCell colSpan={4} />
                  </TableRow>
               </TableFooter>
            </Table>

            <div className="flex flex-wrap items-center justify-between gap-2">
               <p className="text-sm text-muted-foreground">
                  Showing {asNumber(firstRow)}–{asNumber(lastRow)} of {asNumber(shown.length)}
               </p>
               <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                     {PAGE_SIZES.map(size =>
                        <Button
                           key={size}
                           variant={size === pageSize ? 'secondary' : 'ghost'}
                           size="xs"
                           type="button"
                           onClick={() => changePageSize(size)}>
                           {size}
                        </Button>)}
                  </div>
                  <div className="flex items-center gap-1">
                     <Button
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        aria-label="Previous page"
                        disabled={currentPage === 0}
                        onClick={() => setPage(currentPage - 1)}>
                        <ChevronLeftIcon className="size-4" />
                     </Button>
                     <Button
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        aria-label="Next page"
                        disabled={lastRow >= shown.length}
                        onClick={() => setPage(currentPage + 1)}>
                        <ChevronRightIcon className="size-4" />
                     </Button>
                  </div>
               </div>
            </div>

         </CardContent>
      </Card>
   )
}
