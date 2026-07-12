import Big from 'big.js'
import { asDecimal } from '../../../utils/format'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

function StatusCell({ result }) {
   if (!result) {
      return <span className="text-muted-foreground">—</span>
   }
   if (result.error) {
      return <Badge variant="destructive">{result.error}</Badge>
   }
   if (result.txid) {
      return (
         <span className="flex items-center gap-2">
            <Badge>Created</Badge>
            <span className="font-mono text-xs text-muted-foreground">{result.txid}</span>
         </span>
      )
   }
   return <Badge variant="secondary">Validated</Badge>
}

export default function OrderBatchTable({ ordersParams, tradingPairs, createdOrders }) {

   const orders = ordersParams.orders
   if (!orders || orders.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">
            Configure the parameters above and click <i>Show preview</i> to see the orders.
         </p>
      )
   }

   const [base, quote] = tradingPairs?.[ordersParams.pair]?.name.split('/') ?? ['', '']

   const totalBase = orders.reduce((sum, order) => sum.plus(order.volume), Big(0))
   const totalQuote = orders.reduce((sum, order) => sum.plus(order.volume.times(order.price)), Big(0))
   const avgPrice = totalQuote.div(totalBase)

   return (
      <Table className="tabular-nums">
         <TableHeader>
            <TableRow>
               <TableHead>Side</TableHead>
               <TableHead>Type</TableHead>
               <TableHead className="text-right">Volume ({base})</TableHead>
               <TableHead className="text-right">Price ({quote})</TableHead>
               <TableHead className="text-right">Value ({quote})</TableHead>
               <TableHead>Status</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {orders.map((order, i) => {
               const quoteValue = order.volume.times(order.price)
               return (
                  <TableRow key={i}>
                     <TableCell className="capitalize">{ordersParams.direction}</TableCell>
                     <TableCell>limit</TableCell>
                     <TableCell className="text-right">{asDecimal(order.volume.toNumber(), 5)}</TableCell>
                     <TableCell className="text-right">{asDecimal(order.price.toNumber())}</TableCell>
                     <TableCell className="text-right">{asDecimal(quoteValue.toNumber())}</TableCell>
                     <TableCell><StatusCell result={createdOrders?.[i]} /></TableCell>
                  </TableRow>
               )
            })}
         </TableBody>
         <TableFooter>
            <TableRow>
               <TableCell colSpan={2}>Total</TableCell>
               <TableCell className="text-right">{asDecimal(totalBase.toNumber(), 8)}</TableCell>
               <TableCell className="text-right">{asDecimal(avgPrice.toNumber())}</TableCell>
               <TableCell className="text-right">{asDecimal(totalQuote.toNumber())}</TableCell>
               <TableCell></TableCell>
            </TableRow>
         </TableFooter>
      </Table>
   )
}
