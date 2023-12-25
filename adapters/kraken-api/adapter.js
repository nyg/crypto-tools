import { httpRequester } from '../http-requester/server-http-requester'
import { fetchAssetPairs, createOrderBatch, fetchClosedOrders } from './resource'

export default function KrakenAPI(credentials) {

   this.fetchTradingPairs = async function () {
      const assetPairs = (await fetchAssetPairs()).result
      return Object.keys(assetPairs).map(pairId => ({
         id: pairId,
         name: assetPairs[pairId].wsname
      }))
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

   this.fetchClosedOrders = async function ({ asset, fromDate, toDate }) {

      let hasNext = true, orderOffset = 0, fetchedOrderCount = 0
      const allOrders = []

      while (hasNext) {
         const orders = await fetchClosedOrders(credentials, { showTrades: true, fromDate, toDate, orderOffset })
         const orderIds = Object.keys(orders.result.closed)
         fetchedOrderCount += orderIds.length

         hasNext = fetchedOrderCount < orders.result.count
         orderOffset += 50

         const filteredOrders = Object.keys(orders.result.closed)
            .filter(orderId => orders.result.closed[orderId].descr.pair.includes(asset))
            .filter(orderId => Number.parseFloat(orders.result.closed[orderId].vol_exec) !== 0) // TODO
            .map(orderId => orders.result.closed[orderId])

         allOrders.push(...filteredOrders)
      }

      return allOrders
   }
}
