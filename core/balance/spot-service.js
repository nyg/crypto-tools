import Big from 'big.js'
import BinanceConnection from '../../adapters/binance-api/connection.js'


export default function SpotBalanceService(apiKey, apiSecret) {

   const connection = new BinanceConnection(apiKey, apiSecret)


   this.fetchSpotBalance = async function () {
      const account = await connection.fetchAccountInformation()
      return account
         .balances
         .map(balance => ({
            asset: balance.asset,
            amount: Big(balance.free).add(balance.locked)
         }))
         .filter(balance => !balance.amount.eq(0))
         .map(balance => {
            // TODO fix this
            if (balance.asset !== 'LDO' && balance.asset.match(/^LD/)) {
               return { ...balance, asset: balance.asset.substring(2) }
            }
            return balance
         })
         .reduce((map, balance) => {
            map[balance.asset] = balance
            return map
         }, {})
   }

}
