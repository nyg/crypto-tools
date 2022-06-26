import Big from 'big.js'
import RateService from '../../core/rate/rate-service'
import SpotBalanceService from '../../core/balance/spot-service'
import StakingBalanceService from '../../core/balance/staking-service'

const spotBalanceService = new SpotBalanceService(process.env.BINANCE_API_KEY, process.env.BINANCE_API_SECRET)
const stakingBalanceService = new StakingBalanceService(process.env.BINANCE_API_KEY, process.env.BINANCE_API_SECRET)
const rateService = new RateService(process.env.BINANCE_API_KEY, process.env.BINANCE_API_SECRET)


export default async function getAggregateBalance(req, res) {

   const spotBalance = await spotBalanceService.fetchSpotBalance()
   const stakingBalance = await stakingBalanceService.fetchStakingBalance()
   const stakingProducts = await stakingBalanceService.fetchStakingProducts()

   const assets = [...new Set(Object.keys(spotBalance).concat(Object.keys(stakingBalance)))]
   const rates = await rateService.fetchRates(assets)


   const aggregateBalance = assets.map(asset => {

      const spot = spotBalance[asset]?.amount ?? Big(0)
      const staking = stakingBalance[asset] ?? { balance: Big(0), positions: [] }
      staking.products = stakingProducts[asset] ?? []
      const total = spot.add(staking.balance)

      return {
         asset, spot, staking, total,
         totalUSD: total.times(rates[asset])
      }
   })

   aggregateBalance.sort(({ totalUSD: aTotalUSD }, { totalUSD: bTotalUSD }) => bTotalUSD.minus(aTotalUSD))

   res.status(200).json({ balance: aggregateBalance, rates })
}
