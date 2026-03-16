import Big from 'big.js'
import { asDecimal } from '../../utils/format'

export default function OrderBatchPreview({ ordersParams, tradingPairs }) {

   let content
   if (!ordersParams.orders || ordersParams.orders.length === 0) {
      content = (
         <p className="text-sm opacity-50">Configure parameters and click <i>Show preview</i> to see order details</p>
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
            <table className="table table-xs tabular-nums">
               <thead>
                  <tr className="text-xs text-gray-700">
                     <th></th>
                     <th></th>
                     <th className="text-right">{base}</th>
                     <th className="text-right">Price ({quote})</th>
                     <th className="text-right">Value ({quote})</th>
                  </tr>
               </thead>
               <tbody>
                  {ordersParams.orders.map(order => {
                     const quoteValue = order.volume.times(order.price)
                     return (
                        <tr key={order.price}>
                           <td>{ordersParams.direction}</td>
                           <td>limit</td>
                           <td className="text-right">{asDecimal(order.volume.toNumber(), 5)}</td>
                           <td className="text-right">{asDecimal(order.price.toNumber())}</td>
                           <td className="text-right">{asDecimal(quoteValue.toNumber())}</td>
                        </tr>
                     )
                  })}
               </tbody>
               <tfoot>
                  <tr className="text-xs text-gray-700">
                     <td colSpan={2}>Total</td>
                     <td className="text-right">{asDecimal(totalBase.toNumber(), 8)}</td>
                     <td className="text-right">{asDecimal(avgPrice.toNumber())}</td>
                     <td className="text-right">{asDecimal(totalQuote.toNumber())}</td>
                  </tr>
               </tfoot>
            </table>
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
