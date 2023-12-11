import { spotService } from '../../../core/services/spot-service'


export default async function getBalances({ body: { apiKey, apiSecret } }, res) {

   if (!apiKey || !apiSecret) {
      res.status(401).json({ error: 'No API credentials provided.' })
      return
   }

   try {
      const spotBalance = await spotService.fetchKrakenBalance({ apiKey, apiSecret })
      res.status(200).json(spotBalance)
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
