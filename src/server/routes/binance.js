import { Hono } from 'hono'
import Big from 'big.js'
import BinanceAPI from '../adapters/binance-api/adapter.js'
import BinanceGatewayAPI from '../adapters/binance-gateway-api/adapter.js'
import RateFinder from '../services/rate-finder.js'

const app = new Hono()

app.post('/aggregate-balance', async (c) => {

   const { credentials } = await c.req.json()
   if (!credentials) return c.json({ error: 'No API credentials provided.' }, 401)

   let spotBalance, stakingPositions, stakingProducts, tradingPairs, rates, assets
   try {
      const binanceAPI = new BinanceAPI(credentials)
      const binanceGatewayAPI = new BinanceGatewayAPI()

      spotBalance = await binanceAPI.fetchBalances()
      stakingPositions = await binanceAPI.fetchStakingBalances()
      tradingPairs = await binanceAPI.fetchTradingPairs()

      // TODO check if we can fetch via official API
      stakingProducts = await binanceGatewayAPI.fetchStakingProducts()

      assets = [...new Set(Object.keys(spotBalance).concat(Object.keys(stakingPositions)))]

      const rateFinder = new RateFinder(assets)
      const pairs = rateFinder.buildPairs(tradingPairs)
      const pairRates = await binanceAPI.fetchRates(pairs)
      rates = rateFinder.buildRates(pairRates)
   }
   catch (error) {
      if (error.message === 'HTTP Requester Error') {
         console.log('An error happened while contacting the Binance API:', error.cause)
         return c.json({ error: `An error happened while contacting the Binance API: ${error.cause}` }, 500)
      }
      else {
         console.error('An unexpected error happened:', error)
         return c.json({ error: 'An unexpected error happened.' }, 500)
      }
   }

   const aggregateBalance = assets.map(asset => {

      const staking = stakingPositions[asset] ?? { balance: Big(0), positions: [] }

      staking.products = stakingProducts[asset] ?? []
      staking.products.sort((a, b) => Big(b.apy).minus(a.apy))

      staking.products = staking.products.map(product => {
         const positions = staking.positions.filter(position => position.productId === product.id)
         const positionsAmount = positions.map(p => p.amount).reduce((sum, value) => sum.add(value), Big(0))
         return {
            info: {
               positionsAmount,
               ...product
            },
            positions
         }
      })

      const free = spotBalance[asset]?.free ?? Big(0)
      const locked = spotBalance[asset]?.locked ?? Big(0)
      const total = free.add(locked).add(staking.balance)

      return {
         asset,
         free,
         locked,
         staking,
         total,
         freeFiatValue: free.times(rates[asset]),
         fiatValue: total.times(rates[asset])
      }
   })

   // Sort by fiat value of free amount, assets with no staking products at the bottom
   aggregateBalance.sort((a, b) => {
      if (a.staking.products.length == 0 && b.staking.products.length != 0) {
         return 1
      } else if (a.staking.products.length != 0 && b.staking.products.length == 0) {
         return -1
      } else {
         return b.freeFiatValue.minus(a.freeFiatValue)
      }
   })

   return c.json({ balance: aggregateBalance })
})

app.post('/balances', async (c) => {

   const { credentials } = await c.req.json()
   if (!credentials) return c.json({ error: 'No API credentials provided.' }, 401)

   const binanceAPI = new BinanceAPI(credentials)

   const spotBalance = await binanceAPI.fetchBalances()
   const stakingPositions = await binanceAPI.fetchStakingBalances()

   const assets = [...new Set(Object.keys(spotBalance).concat(Object.keys(stakingPositions)))]

   const balances = assets
      .map(asset => {
         const free = spotBalance[asset]?.free ?? Big(0)
         const locked = spotBalance[asset]?.locked ?? Big(0)
         const staked = stakingPositions[asset]?.balance ?? Big(0)
         return { asset, balance: free.add(locked).add(staked) }
      })
      .reduce((balances, balance) => {
         balances[balance.asset] = balance.balance
         return balances
      }, {})

   return c.json(balances)
})

app.post('/deposits', async (c) => {

   const { credentials, fromDate } = await c.req.json()
   if (!credentials) return c.json({ error: 'No API credentials provided.' }, 401)

   const binanceAPI = new BinanceAPI(credentials)

   const computeToDate = fromDate => fromDate + 90 * 24 * 3600 * 1000
   const delay = ms => new Promise(r => setTimeout(r, ms))

   let hasNext = true
   let currentFromDate = fromDate
   let toDate = computeToDate(currentFromDate)
   const allDeposits = []

   while (hasNext) {
      const deposits = await binanceAPI.fetchFiatDeposits(currentFromDate, toDate)
      allDeposits.push(...deposits)

      hasNext = toDate < Date.now()
      currentFromDate = toDate + 1
      toDate = computeToDate(currentFromDate)

      await delay(35000)
   }

   return c.json({ deposits: allDeposits })
})

app.get('/eoy-rates', async (c) => {

   const binanceAPI = new BinanceAPI()

   const startTime = new Date('2024-01-01T23:28:00Z').getTime()
   const endTime = new Date('2024-01-01T23:29:00Z').getTime()

   const assets = ['1INCH', 'AAVE', 'ADA', 'ALGO', 'ATOM', 'AXS', 'BAND', 'BAT', 'BCH', 'BTTC', 'BNB', 'BONK', 'BTC', 'CFG', 'CHSB', 'COMP', 'CRO', 'CRV', 'DOGE', 'DOT', 'DYDX', 'ENJ', 'EOS', 'ETH', 'ETHW', 'FIL', 'FLR', 'GO', 'GRT', 'HEGIC', 'KNC', 'LRC', 'LTC', 'LUNA', 'LUNC', 'MATIC', 'OGN', 'OGV', 'OP', 'PEPE', 'REEF', 'REN', 'SAND', 'SGB', 'SHIB', 'SNX', 'SOL', 'UMA', 'UNI', 'UTK', 'XLM', 'XMR', 'XRP', 'XTZ', 'ZEC', 'ZRX']
   const rates = {}

   for (const asset of assets) {
      try {
         const candlestick = await binanceAPI.fetchCandlestickData(`${asset}USDT`, '1m', startTime, endTime, 1)
         rates[asset] = candlestick[0].close
      }
      catch (error) {
         console.error(error)
      }
   }

   return c.text(Object.keys(rates).map(pair => `${pair},${rates[pair]}`).join('\n'))
})

export default app
