import { Hono } from 'hono'
import KrakenAPI from '../adapters/kraken-api/adapter'
import ledgerRoutes from './kraken-ledger'
import xstockRoutes from './kraken-xstocks'
import { handleError, withCredentials } from './with-account'
import type { KrakenOrderBatchParams } from '../../types/kraken-api'

const app = new Hono()

app.route('/ledger', ledgerRoutes)
app.route('/xstocks', xstockRoutes)

// What the local ledger cannot know: the balance Kraken holds this second, and how
// much of it an open order has already claimed. The Balances page reads everything
// else from the database and asks for this on top, so a stale sync shows up as a
// difference rather than as a wrong number.
app.post('/balances', async (c) => withCredentials(c, 'kraken', async ({ credentials }) => {

   const krakenAPI = new KrakenAPI(credentials)

   // Sequentially rather than with Promise.all. The resource layer would queue them
   // anyway — Kraken rejects private calls whose nonces arrive out of order — and
   // asking for them one at a time says so at the call site.
   const assets = await krakenAPI.fetchLiveBalances()
   const openOrders = await krakenAPI.fetchOpenOrders()

   return c.json({ fetchedAt: Date.now(), assets, openOrders })
}))

app.post('/open-orders', async (c) => withCredentials(c, 'kraken', async ({ credentials }) => {

   const krakenAPI = new KrakenAPI(credentials)

   const orders = await krakenAPI.fetchOpenOrders()
   const prices = await krakenAPI.fetchPairPrices(orders.map(order => order.rawPair))

   return c.json({ fetchedAt: Date.now(), orders, prices })
}))

app.post('/cancel-orders', async (c) => withCredentials(c, 'kraken', async ({ body, credentials }) => {

   const txids = (body.txids as string[] ?? []).filter(Boolean)
   if (txids.length === 0) return c.json({ error: 'No order was given to cancel.' }, 400)

   return c.json(await new KrakenAPI(credentials).cancelOrders(txids))
}))

app.post('/order-batch', async (c) => withCredentials(c, 'kraken', async ({ body, credentials }) =>
   c.json(await new KrakenAPI(credentials).createOrders(body.ordersParams as KrakenOrderBatchParams))))

// Public data, so no credentials: the caller says which assets it holds, not who it is.
app.post('/asset-rates', async (c) => {

   const { assets = [] } = await c.req.json<{ assets?: string[] }>()

   try {
      const krakenAPI = new KrakenAPI()
      return c.json({ rates: await krakenAPI.fetchUsdRates(assets) })
   }
   catch (error) {
      return handleError(c, error)
   }
})

app.get('/trading-pairs', async (c) => {

   try {
      const krakenAPI = new KrakenAPI()
      const tradingPairs = await krakenAPI.fetchTradingPairs()
      return c.json(tradingPairs)
   }
   catch (error) {
      return handleError(c, error)
   }
})

export default app
