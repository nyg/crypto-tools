import KrakenAPI from '../../../adapters/kraken-api/adapter'
import MarketService from '../../../core/services/market-service'

export default async function getClosedOrders({ body: { credentials, searchParams } }, res) {

   if (!credentials) {
      res.status(401).json({ error: 'No API credentials provided.' })
      return
   }

   try {
      const krakenAPI = new KrakenAPI(credentials)
      const marketService = new MarketService(krakenAPI)
      const closedOrders = await marketService.fetchClosedOrders(searchParams)
      const tradingPairs = await marketService.fetchTradingPairs()

      const groupedOrders = closedOrders.reduce((groupedOrders, order) => {

         const pair = order.pair
         const direction = order.direction

         groupedOrders[pair] ??= { pair: tradingPairs[order.pair] }
         groupedOrders[pair][direction] ??= { orders: [], summary: { volume: 0, cost: 0, price: 0 } }

         groupedOrders[pair][direction].orders.push(order)

         // update average price
         if (groupedOrders[pair][direction].summary.price === 0) {
            groupedOrders[pair][direction].summary.price = Number.parseFloat(order.cost) / Number.parseFloat(order.volume)
         }
         else {
            groupedOrders[pair][direction].summary.price =
               (groupedOrders[pair][direction].summary.cost + Number.parseFloat(order.cost)) /
               (groupedOrders[pair][direction].summary.volume + Number.parseFloat(order.volume))
         }

         // update volume and cost
         groupedOrders[pair][direction].summary.volume += Number.parseFloat(order.volume)
         groupedOrders[pair][direction].summary.cost += Number.parseFloat(order.cost)

         return groupedOrders
      }, {})

      // console.dir(groupedOrders, { depth: null })
      res.status(200).json(groupedOrders)
   }
   catch (error) {
      if (error.message === 'HTTP Requester Error') {
         console.log('An error happened while contacting the Kraken API:', error.cause)
         res.status(500).json({ error: `An error happened while contacting the Kraken API: ${error.cause}` })
      }
      else {
         console.error('An unexpected error happened:', error)
         res.status(500).json({ error: 'An unexpected error happened.' })
      }
   }
}
