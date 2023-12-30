import Big from 'big.js'
import { binanceConnection } from '../../../adapters/binance-api/connection'


function StakingService() {

   this.fetchStakingBalance = async function (apiCredentials) {
      const positions = await binanceConnection.fetchStakingPositions(apiCredentials)
      return positions.reduce((map, position) => {
         map[position.asset] ??= { balance: Big(0), positions: [] }
         map[position.asset].balance = map[position.asset].balance.add(position.amount)
         map[position.asset].positions.push(position)
         return map
      }, {})
   }

}

export const stakingService = new StakingService()
