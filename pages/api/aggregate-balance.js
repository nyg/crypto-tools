import Big from 'big.js'
import RateService from '../../core/rate/rate-service'
import SpotBalanceService from '../../core/balance/spot-service'
import StakingBalanceService from '../../core/balance/staking-service'

let spotBalanceService
let stakingBalanceService
let rateService


export default async function getAggregateBalance(req, res) {

   if (!req.body.apiKey || !req.body.apiSecret) {
      res.status(401)
      return
   }

   initServices(req.body.apiKey, req.body.apiSecret)

   const spotBalance = await spotBalanceService.fetchSpotBalance()
   const stakingBalance = await stakingBalanceService.fetchStakingBalance()
   const stakingProducts = await stakingBalanceService.fetchStakingProducts()

   const assets = [...new Set(Object.keys(spotBalance).concat(Object.keys(stakingBalance)))]
   const rates = await rateService.fetchRates(assets)


   const aggregateBalance = assets.map(asset => {

      const staking = stakingBalance[asset] ?? { balance: Big(0), positions: [] }

      staking.products = stakingProducts[asset] ?? []
      staking.products = staking.products.map(product => {
         const positions = staking.positions.filter(position => position.productId === product.projectId)
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
      }

      if (a.staking.products.length != 0 && b.staking.products.length == 0) {
         return -1
      }

      return b.freeFiatValue.minus(a.freeFiatValue)
   })

   res.status(200).json({ balance: aggregateBalance })
}

function initServices(apiKey, apiSecret) {
   spotBalanceService ??= new SpotBalanceService(apiKey, apiSecret)
   stakingBalanceService ??= new StakingBalanceService(apiKey, apiSecret)
   rateService ??= new RateService(apiKey, apiSecret)
}
