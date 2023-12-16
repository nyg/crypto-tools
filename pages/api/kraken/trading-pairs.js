import KrakenAPI from '../../../adapters/kraken-api/adapter'
import MarketService from '../../../core/services/market-service'

export default async function getTradingPairs(req, res) {

   try {
      const krakenAPI = new KrakenAPI()
      const marketService = new MarketService(krakenAPI)
      const tradingPairs = await marketService.fetchTradingPairs()
      console.log(tradingPairs)
      res.status(200).json(tradingPairs)
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

      return
   }
}
