import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import OpenOrderStats from './open-order-stats'
import { asCount } from '../lib/filter-options'
import { asAssetAmount, asNumber, asPercentage, asUtcTimestamp } from '../../../utils/format'

const PAGE_SIZES = [10, 25, 50]

const distanceFrom = (order, lastPrice) =>
   lastPrice == null || lastPrice === 0 ? null : (Number(order.price) - lastPrice) / lastPrice

export default function OpenOrderGroup({ group, lastPrice, selected, onSelectionChange, onCancel }) {

   const [page, setPage] = useState(0)
   const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

   const { orders, pairKey, baseAsset, quoteAsset } = group

   const pageCount = Math.max(1, Math.ceil(orders.length / pageSize))
   const currentPage = Math.min(page, pageCount - 1)
   const rows = orders.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

   const selectedOrders = orders.filter(order => selected.has(order.txid))
   const allSelected = selectedOrders.length === orders.length && orders.length > 0

   const toggleAll = () => onSelectionChange(allSelected ? [] : orders.map(order => order.txid))

   const toggleOne = (txid) => {
      const next = new Set(selected)
      if (!next.delete(txid)) next.add(txid)
      onSelectionChange([...next])
   }

   const changePageSize = (size) => {
      setPageSize(size)
      setPage(0)
   }

   const firstRow = currentPage * pageSize + 1
   const lastRow = Math.min(orders.length, (currentPage + 1) * pageSize)

   return (
      <Card>
         <CardHeader>
            <CardTitle className="flex items-center gap-2">
               {pairKey || 'Unknown pair'}
               <Badge variant="outline">{asCount(orders.length, 'order')}</Badge>
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
         <CardContent className="space-y-4">

            <OpenOrderStats
               orders={orders}
               baseAsset={baseAsset}
               quoteAsset={quoteAsset}
               lastPrice={lastPrice} />

            <Table className="tabular-nums">
               <TableHeader>
                  <TableRow>
                     <TableHead className="w-8">
                        <Checkbox
                           checked={allSelected}
                           aria-label={`Select every ${pairKey} order`}
                           onCheckedChange={toggleAll} />
                     </TableHead>
                     <TableHead>Side</TableHead>
                     <TableHead>Type</TableHead>
                     <TableHead>Reference</TableHead>
                     <TableHead className="text-right">Volume</TableHead>
                     <TableHead className="text-right">Price</TableHead>
                     <TableHead className="text-right">Cost</TableHead>
                     <TableHead className="text-right">To market</TableHead>
                     <TableHead>Opened (UTC)</TableHead>
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
                              <Badge variant={order.type === 'sell' ? 'outline' : 'secondary'}>
                                 {order.type || '—'}
                              </Badge>
                           </TableCell>
                           <TableCell className="text-muted-foreground">{order.ordertype || '—'}</TableCell>
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
                           <TableCell className="whitespace-nowrap text-muted-foreground">
                              {asUtcTimestamp(order.opened)}
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
                                 <XIcon />
                              </Button>
                           </TableCell>
                        </TableRow>
                     )
                  })}
               </TableBody>
            </Table>

            <div className="flex flex-wrap items-center justify-between gap-2">
               <p className="text-sm text-muted-foreground">
                  Showing {asNumber(firstRow)}–{asNumber(lastRow)} of {asNumber(orders.length)}
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
                        disabled={lastRow >= orders.length}
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
