import KrakenAPI from '../../../lib/adapters/kraken-api/adapter'

export default async function postOrderBatch({ body: { credentials, ordersParams } }, res) {

   if (!credentials) {
      res.status(401).json({ error: 'No API credentials provided.' })
      return
   }

   try {
      const krakenAPI = new KrakenAPI(credentials)
      const orders = await krakenAPI.createOrders(ordersParams)

      res.status(200).json(orders)
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
