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
      console.log(closedOrders)
      res.status(200).json(closedOrders)
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
