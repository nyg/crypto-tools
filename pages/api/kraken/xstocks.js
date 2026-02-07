import AnthropicAPI from '../../../lib/adapters/anthropic/adapter'
import KrakenAPI from '../../../lib/adapters/kraken-api/adapter'


export default async function getETFs(req, res) {

   const { credentials, excludeStocks = true, etfWordCount = 50 } = req.body
   if (!credentials) {
      res.status(401).json({ error: 'No API credentials provided.' })
      return
   }

   try {
      const krakenAPI = new KrakenAPI()
      const assets = await krakenAPI.fetchAssets('tokenized_asset')
      const xStocks = Object.keys(assets)
         .filter(a => a.endsWith('x'))
         .map(a => a.replace(/x$/, ''))
         .join(', ')

      const anthropicAPI = new AnthropicAPI(credentials.apiKey)
      const classifiedAssets = await anthropicAPI.classifyAssets(xStocks, excludeStocks, etfWordCount)

      res.status(200).json({
         assets: classifiedAssets
      })
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
