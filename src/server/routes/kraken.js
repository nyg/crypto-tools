import { Hono } from 'hono'
import KrakenAPI from '../adapters/kraken-api/adapter.js'
import ledgerRoutes from './kraken-ledger.js'
import xstockRoutes from './kraken-xstocks.js'

const app = new Hono()

// Mounted here rather than in the server entry points, which each declare their own
// route table: adding it in only one of them would 404 in the other runtime.
app.route('/ledger', ledgerRoutes)
app.route('/xstocks', xstockRoutes)

// What the local ledger cannot know: the balance Kraken holds this second, and how
// much of it an open order has already claimed. The Balances page reads everything
// else from the database and asks for this on top, so a stale sync shows up as a
// difference rather than as a wrong number.
app.post('/balances', async (c) => {

   const { credentials } = await c.req.json()
   if (!credentials) return c.json({ error: 'No API credentials provided.' }, 401)

   try {
      const krakenAPI = new KrakenAPI(credentials)

      // Sequentially rather than with Promise.all. The resource layer would queue them
      // anyway — Kraken rejects private calls whose nonces arrive out of order — and
      // asking for them one at a time says so at the call site.
      const assets = await krakenAPI.fetchLiveBalances()
      const openOrders = await krakenAPI.fetchOpenOrders()

      return c.json({ fetchedAt: Date.now(), assets, openOrders })
   }
   catch (error) {
      if (error.message === 'HTTP Requester Error') {
         console.log('An error happened while contacting the Kraken API:', error.cause)
         return c.json({ error: `An error happened while contacting the Kraken API: ${error.cause}` }, 500)
      }
      else {
         console.error('An unexpected error happened:', error)
         return c.json({ error: 'An unexpected error happened.' }, 500)
      }
   }
})

app.post('/order-batch', async (c) => {

   const { credentials, ordersParams } = await c.req.json()
   if (!credentials) return c.json({ error: 'No API credentials provided.' }, 401)

   try {
      const krakenAPI = new KrakenAPI(credentials)
      const orders = await krakenAPI.createOrders(ordersParams)
      return c.json(orders)
   }
   catch (error) {
      if (error.message === 'HTTP Requester Error') {
         console.log('An error happened while contacting the Kraken API:', error.cause)
         return c.json({ error: `An error happened while contacting the Kraken API: ${error.cause}` }, 500)
      }
      else {
         console.error('An unexpected error happened:', error)
         return c.json({ error: 'An unexpected error happened.' }, 500)
      }
   }
})

// Public data, so no credentials: the caller says which assets it holds, not who it is.
app.post('/asset-rates', async (c) => {

   const { assets = [] } = await c.req.json()

   try {
      const krakenAPI = new KrakenAPI()
      return c.json({ rates: await krakenAPI.fetchUsdRates(assets) })
   }
   catch (error) {
      if (error.message === 'HTTP Requester Error') {
         console.log('An error happened while contacting the Kraken API:', error.cause)
         return c.json({ error: `An error happened while contacting the Kraken API: ${error.cause}` }, 500)
      }
      else {
         console.error('An unexpected error happened:', error)
         return c.json({ error: 'An unexpected error happened.' }, 500)
      }
   }
})

app.get('/trading-pairs', async (c) => {

   try {
      const krakenAPI = new KrakenAPI()
      const tradingPairs = await krakenAPI.fetchTradingPairs()
      return c.json(tradingPairs)
   }
   catch (error) {
      if (error.message === 'HTTP Requester Error') {
         console.log('An error happened while contacting the Kraken API:', error.cause)
         return c.json({ error: `An error happened while contacting the Kraken API: ${error.cause}` }, 500)
      }
      else {
         console.error('An unexpected error happened:', error)
         return c.json({ error: 'An unexpected error happened.' }, 500)
      }
   }
})

export default app
