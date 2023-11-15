import Big from 'big.js'
import { binanceConnection } from '../adapters/binance-api/connection'
import { binanceGatewayConnection } from '../adapters/binance-gateway-api/connection'


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

   this.fetchStakingProducts = async function () {
      const products = await binanceGatewayConnection.fetchStakingProducts()
      return products.data.list.reduce((map, products) => {
         map[products.asset] = products.productDetailList
         return map
      }, {})
   }
}

export const stakingService = new StakingService()
