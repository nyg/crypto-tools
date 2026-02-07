import Big from 'big.js'
import BinanceAPI from '../../../lib/adapters/binance-api/adapter'


export default async function balances({ body: { credentials } }, res) {

   if (!credentials) {
      res.status(401).json({ error: 'No API credentials provided.' })
      return
   }

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

   res.status(200).json(balances)
}
