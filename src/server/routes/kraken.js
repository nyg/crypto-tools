import { Hono } from 'hono'
import Big from 'big.js'
import KrakenAPI from '../adapters/kraken-api/adapter.js'
import AnthropicAPI from '../adapters/anthropic/adapter.js'

const app = new Hono()

app.post('/balances', async (c) => {

   const { credentials } = await c.req.json()
   if (!credentials) return c.json({ error: 'No API credentials provided.' }, 401)

   try {
      const krakenAPI = new KrakenAPI(credentials)
      const balances = await krakenAPI.fetchBalances()

      const balancesSum = Object.keys(balances)
         .map(asset => {
            const free = balances[asset]?.free ?? Big(0)
            const staking = balances[asset]?.staking ?? Big(0)
            const earning = balances[asset]?.earning ?? Big(0)
            const parachain = balances[asset]?.parachain ?? Big(0)
            return { asset, balance: free.add(staking).add(earning).add(parachain) }
         })
         .filter(balance => balance.balance != 0)
         .reduce((balances, balance) => {
            balances[balance.asset] = balance.balance
            return balances
         }, {})

      const acceptHeader = c.req.header('accept') || 'application/json'
      if (acceptHeader.includes('text/csv')) {
         return c.text(Object.keys(balancesSum).map(asset => `${asset};${balancesSum[asset]}`).join('\n'))
      }
      return c.json(balancesSum)
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

app.post('/closed-orders', async (c) => {

   const { credentials, searchParams } = await c.req.json()
   if (!credentials) return c.json({ error: 'No API credentials provided.' }, 401)

   try {
      const krakenAPI = new KrakenAPI(credentials)
      const closedOrders = await krakenAPI.fetchClosedOrders(searchParams)
      const tradingPairs = await krakenAPI.fetchTradingPairs()

      const groupedOrders = closedOrders.reduce((groupedOrders, order) => {

         const pair = order.pair
         const direction = order.direction

         groupedOrders[pair] ??= { pair: tradingPairs[order.pair] ?? { id: order.pair, name: order.pair, base: { decimals: 8 }, quote: { decimals: 8 } } }
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

      return c.json(groupedOrders)
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

app.post('/xstocks', async (c) => {

   const { credentials, excludeStocks = true, etfWordCount = 50 } = await c.req.json()
   if (!credentials) return c.json({ error: 'No API credentials provided.' }, 401)

   try {
      const krakenAPI = new KrakenAPI()
      const assets = await krakenAPI.fetchAssets('tokenized_asset')
      const xStocks = Object.keys(assets)
         .filter(a => a.endsWith('x'))
         .map(a => a.replace(/x$/, ''))
         .join(', ')

      const anthropicAPI = new AnthropicAPI(credentials.apiKey)
      const classifiedAssets = await anthropicAPI.classifyAssets(xStocks, excludeStocks, etfWordCount)

      return c.json({
         assets: classifiedAssets
      })
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
