import Big from 'big.js'
import BinanceAPI from '../../../adapters/binance-api/adapter'
import UserService from '../../../core/services/user-service'
import StakingService from '../../../core/services/staking-service'


export default async function balances({ body: { credentials } }, res) {

   if (!credentials) {
      res.status(401).json({error: 'No API credentials provided.'})
      return
   }

   const binanceAPI = new BinanceAPI(credentials)
   const userService = new UserService(binanceAPI)
   const stakingService = new StakingService(binanceAPI)

   const spotBalance = await userService.fetchBalances()
   const stakingPositions = await stakingService.fetchStakingBalances()

   const assets = [...new Set(Object.keys(spotBalance).concat(Object.keys(stakingPositions)))]

   const balances = assets.map(asset => {
      const free = spotBalance[asset]?.free ?? Big(0)
      const locked = spotBalance[asset]?.locked ?? Big(0)
      const staked = stakingPositions[asset]?.balance ?? Big(0)
      return { asset, balance: free.add(locked).add(staked) }
   })

   const text = balances.map(balance => `${balance.asset},${balance.balance}`).join('\n')

   res.status(200).send(text)
}
