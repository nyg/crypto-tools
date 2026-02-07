export default function OrderBatchPreview({ ordersParams, tradingPairs }) {

   let content
   if (!ordersParams.orders || ordersParams.orders.length === 0) {
      content = (
         <p className="text-gray-400 text-sm">Configure parameters and click <i>Show preview</i> to see order details</p>
      )
   }
   else {
      const [base, quote] = tradingPairs[ordersParams.pair]?.name.split('/')

      const totalBase = ordersParams.orders.reduce((sum, order) =>
         sum + parseFloat(order.volume), 0)

      const totalQuote = ordersParams.orders.reduce((sum, order) =>
         sum + (parseFloat(order.volume) * parseFloat(order.price)), 0)

      const avgPrice = totalQuote / totalBase

      content = (
         <>
            <div className="space-y-0.5">
               {ordersParams.orders.map(order => {
                  const quoteValue = (parseFloat(order.volume) * parseFloat(order.price))
                     .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  return (
                     <p key={order.price}>
                        {`${ordersParams.direction} ${order.volume} ${base} @ limit ${order.price} ${quote} (${quoteValue} ${quote})`}
                     </p>
                  )
               })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-600">
               <table className="w-full">
                  <tbody>
                     <tr>
                        <td>Total {base}</td>
                        <td className="text-right tabular-nums">{totalBase.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })}</td>
                     </tr>
                     <tr>
                        <td>Total {quote}</td>
                        <td className="text-right tabular-nums">{totalQuote.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                     </tr>
                     <tr>
                        <td>Average price</td>
                        <td className="text-right tabular-nums">{avgPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </>
      )
   }

   return (
      <div>
         <h3 className="pb-2 font-semibold">Preview</h3>
         {content}
      </div >
   )
}
