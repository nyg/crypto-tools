import Big from 'big.js'
import KrakenAPI from '../../../adapters/kraken-api/adapter'
import UserService from '../../../core/services/user-service'


export default async function getBalances({ body: { credentials } }, res) {

   if (!credentials) {
      res.status(401).json({ error: 'No API credentials provided.' })
      return
   }

   console.log(credentials)

   try {
      const userService = new UserService(new KrakenAPI(credentials))
      const balances = await userService.fetchBalances()

      const balancesSum = Object.keys(balances)
         .map(asset => {
            const free = balances[asset]?.free ?? Big(0)
            const trade = balances[asset]?.trade ?? Big(0)
            const staking = balances[asset]?.staking ?? Big(0)
            const earning = balances[asset]?.earning ?? Big(0)
            const parachain = balances[asset]?.parachain ?? Big(0)
            return { asset, balance: free.add(trade).add(staking).add(earning).add(parachain) }
         })
         .reduce((balances, balance) => {
            balances[balance.asset] = balance.balance
            return balances
         }, {})


      res.status(200).json(balancesSum)
   }
   catch (error) {
      if (error.message === 'HTTP Requester Error') {
         console.log('An error happened while contacting the Kraken API:', error.cause)
         res.status(500).json({ error: `An error happened while contacting the Kraken API: ${error.cause}` })
      }
      else {
         console.error('An unexpected error happened:', error)
         res.status(500).json({ error: 'An unexpected error happened.' })
      }

      return
   }
}
