import Big from 'big.js'
import BinanceAPI from '../../../adapters/binance-api/adapter'
import BinanceGatewayAPI from '../../../adapters/binance-gateway-api/adapter'
import StakingService from '../../../core/services/staking-service'
import UserService from '../../../core/services/user-service'
import MarketService from '../../../core/services/market-service'
import RateFinder from '../../../core/rate-finder'


export default async function aggregateBalance({ body: { credentials } }, res) {

   if (!credentials) {
      res.status(401).json({ error: 'No API credentials provided.' })
      return
   }

   let spotBalance, stakingPositions, stakingProducts, tradingPairs, rates, assets
   try {
      const binanceAPI = new BinanceAPI(credentials)
      const binanceGatewayAPI = new BinanceGatewayAPI()

      const userService = new UserService(binanceAPI)
      const stakingService = new StakingService(binanceAPI)
      const marketService = new MarketService(binanceAPI)
      const publicStakingService = new StakingService(binanceGatewayAPI)

      spotBalance = await userService.fetchBalances()
      stakingPositions = await stakingService.fetchStakingBalances()
      tradingPairs = await marketService.fetchTradingPairs()

      // TODO check if we can fetch via official API
      stakingProducts = await publicStakingService.fetchStakingProducts()

      assets = [...new Set(Object.keys(spotBalance).concat(Object.keys(stakingPositions)))]

      const rateFinder = new RateFinder(assets)
      const pairs = rateFinder.buildPairs(tradingPairs)
      const pairRates = await marketService.fetchRates(pairs)
      rates = rateFinder.buildRates(pairRates)
   }
   catch (error) {
      if (error.message === 'HTTP Requester Error') {
         console.log('An error happened while contacting the Binance API:', error.cause)
         res.status(500).json({ error: `An error happened while contacting the Binance API: ${error.cause}` })
         return
      }
      else {
         console.error('An unexpected error happened:', error)
         res.status(500).json({ error: 'An unexpected error happened.' })
         return
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

   res.status(200).json({ balance: aggregateBalance })
}
