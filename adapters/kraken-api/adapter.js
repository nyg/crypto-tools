import { fetchAssetPairs, createOrderBatch, fetchClosedOrders } from './resource'

export default function KrakenAPI(credentials) {

   this.fetchTradingPairs = async function () {
      const assetPairs = (await fetchAssetPairs()).result
      return Object.keys(assetPairs)
         .map(pairId => ({
            id: assetPairs[pairId].altname,
            name: assetPairs[pairId].wsname,
            base: {
               name: assetPairs[pairId].base,
               decimals: assetPairs[pairId].lot_decimals,
            },
            quote: {
               name: assetPairs[pairId].quote,
               decimals: assetPairs[pairId].cost_decimals,
            }
         }))
         .reduce((pairs, pair) => {
            pairs[pair.id] = pair
            return pairs
         }, {})
   }

   this.createOrders = async function ({ orders, ...args }) {

      // maximum number of orders that can be created per API call
      const maxOrderCount = 15

      const orderChunks = []
      for (let i = 0; i < orders.length; i += maxOrderCount) {
         orderChunks.push(orders.slice(i, i + maxOrderCount))
      }

      const promises = orderChunks.map(orderChunk =>
         createOrderBatch(credentials, { ...args, orders: orderChunk }))
      const responses = await Promise.all(promises)

      return responses.flatMap(response => response.result.orders)
   }

   this.fetchClosedOrders = async function ({ assetFilter, fromDate, toDate }) {

      let hasNext = true, orderOffset = 0, fetchedOrderCount = 0
      const allOrders = []

      while (hasNext) {
         const orders = await fetchClosedOrders(credentials, { showTrades: true, fromDate, toDate, orderOffset })
         const orderIds = Object.keys(orders.result.closed)

         fetchedOrderCount += orderIds.length
         hasNext = fetchedOrderCount < orders.result.count
         orderOffset += 50

         const filteredOrders = orderIds
            .filter(orderId => assetFilter ? orders.result.closed[orderId].descr.pair.includes(assetFilter) : true)
            .filter(orderId => Number.parseFloat(orders.result.closed[orderId].vol_exec) !== 0) // TODO
            .map(orderId => ({
               orderId,
               pair: orders.result.closed[orderId].descr.pair,
               direction: orders.result.closed[orderId].descr.type,
               volume: orders.result.closed[orderId].vol_exec,
               cost: orders.result.closed[orderId].cost,
               price: orders.result.closed[orderId].price,
               openedDate: orders.result.closed[orderId].opentm,
               closedDate: orders.result.closed[orderId].closetm
            }))

         allOrders.push(...filteredOrders)
      }

      return allOrders.toSorted((a, b) => a.openedDate - b.openedDate)
   }
}
