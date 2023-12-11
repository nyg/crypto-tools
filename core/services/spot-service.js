import Big from 'big.js'
import { binanceConnection } from '../../adapters/binance-api/connection'
import { krakenConnection } from '../../adapters/kraken-api/connection'


function SpotService() {

   this.fetchSpotBalance = async function (apiCredentials) {
      const balance = await binanceConnection.fetchSpotBalance(apiCredentials)
      return balance
         .map(balance => ({
            asset: balance.asset,
            free: Big(balance.free),
            locked: Big(balance.locked)
         }))
         .reduce((map, balance) => {
            map[balance.asset] = balance
            return map
         }, {})
   }

   this.fetchFiatDeposits = async function (apiCredentials) {
      const deposits = await binanceConnection.fetchFiatDeposits(apiCredentials)
      return deposits
   }

   // TODO
   this.fetchKrakenBalance = async function (apiCredentials) {
      return krakenConnection.fetchExtendedBalance(apiCredentials)
   }
}

export const spotService = new SpotService()
