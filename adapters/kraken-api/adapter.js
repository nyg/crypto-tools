import { createOrderBatch } from './resource'

export default function KrakenAPI(credentials) {

   this.createOrders = async function ({ orders, ...args }) {

      // maximum number of orders that can be create in one batch
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
}
