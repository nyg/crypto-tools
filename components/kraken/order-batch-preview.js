import Big from 'big.js'
import { asDecimal } from '../../utils/format'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function OrderBatchPreview({ ordersParams, tradingPairs }) {

   let content
   if (!ordersParams.orders || ordersParams.orders.length === 0) {
      content = (
         <p className="text-sm text-muted-foreground">Configure parameters and click <i>Show preview</i> to see order details</p>
      )
   }
   else {
      const [base, quote] = tradingPairs[ordersParams.pair]?.name.split('/')

      const totalBase = ordersParams.orders.reduce((sum, order) =>
         sum.plus(order.volume), Big(0))

      const totalQuote = ordersParams.orders.reduce((sum, order) =>
         sum.plus(order.volume.times(order.price)), Big(0))

      const avgPrice = totalQuote.div(totalBase)

      content = (
         <div className="overflow-x-auto">
            <Table className="tabular-nums">
               <TableHeader>
                  <TableRow>
                     <TableHead></TableHead>
                     <TableHead></TableHead>
                     <TableHead className="text-right">{base}</TableHead>
                     <TableHead className="text-right">Price ({quote})</TableHead>
                     <TableHead className="text-right">Value ({quote})</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {ordersParams.orders.map(order => {
                     const quoteValue = order.volume.times(order.price)
                     return (
                        <TableRow key={order.price}>
                           <TableCell>{ordersParams.direction}</TableCell>
                           <TableCell>limit</TableCell>
                           <TableCell className="text-right">{asDecimal(order.volume.toNumber(), 5)}</TableCell>
                           <TableCell className="text-right">{asDecimal(order.price.toNumber())}</TableCell>
                           <TableCell className="text-right">{asDecimal(quoteValue.toNumber())}</TableCell>
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
                  </TableRow>
               </TableFooter>
            </Table>
         </div>
      )
   }

   return (
      <div>
         <h3 className="pb-2 font-semibold">Preview</h3>
         {content}
      </div >
   )
}
