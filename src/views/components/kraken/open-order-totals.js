import Big from 'big.js'

export function summarize(orders) {

   const count = orders.length
   const volume = orders.reduce((sum, order) => sum.plus(order.remaining), Big(0))
   const value = orders.reduce((sum, order) => sum.plus(order.value), Big(0))
   const price = orders.reduce((sum, order) => sum.plus(order.price), Big(0))

   const perOrder = total => count === 0 ? null : total.div(count)

   return {
      count,
      buys: orders.filter(order => order.type === 'buy').length,
      sells: orders.filter(order => order.type === 'sell').length,
      volume,
      value,
      price,
      averageVolume: perOrder(volume),
      averagePrice: perOrder(price),
      averageValue: perOrder(value),
      weightedPrice: volume.eq(0) ? null : value.div(volume)
   }
}
