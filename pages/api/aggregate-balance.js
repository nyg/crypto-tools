import Big from 'big.js'
import { spotService } from '../../core/services/spot-service'
import { stakingService } from '../../core/services/staking-service'
import { rateService } from '../../core/services/rate-service'


export default async function getAggregateBalance({ body: { apiKey, apiSecret } }, res) {

   if (!apiKey || !apiSecret) {
      res.status(401).json({error: 'No API credentials provided.'})
      return
   }

   const apiCredentials = { apiKey, apiSecret}

   let spotBalance, stakingPositions, stakingProducts
   try {
      spotBalance = await spotService.fetchSpotBalance(apiCredentials)
      stakingPositions = await stakingService.fetchStakingBalance(apiCredentials)
      stakingProducts = await stakingService.fetchStakingProducts() // TODO check if we can fetch via official API
   }
   catch (error) {
      if (error.message === 'HTTP Requester Error') {
         console.log('An error happened while contacting the Binance API:', error.cause)
         res.status(500).json({ error: `An error happened while contacting the Binance API: ${error.cause}` })
      }
      else {
         console.error('An unexpected error happened:', error)
         res.status(500).json({ error: 'An unexpected error happened.' })
      }

      return
   }

   const assets = [...new Set(Object.keys(spotBalance).concat(Object.keys(stakingPositions)))]
   const rates = await rateService.fetchRates(assets)


   const aggregateBalance = assets.map(asset => {

      const staking = stakingPositions[asset] ?? { balance: Big(0), positions: [] }

      staking.products = stakingProducts[asset] ?? []
      staking.products.sort((a, b) => Big(b.apy).minus(a.apy))

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
      } else if (a.staking.products.length != 0 && b.staking.products.length == 0) {
         return -1
      } else {
         return b.freeFiatValue.minus(a.freeFiatValue)
      }
   })

   res.status(200).json({ balance: aggregateBalance })
}
