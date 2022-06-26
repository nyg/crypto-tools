import Big from 'big.js'
import BinanceConnection from '../../adapters/binance-api/connection.js'
import BinanceGatewayConnection from '../../adapters/binance-gateway-api/connection.js'


export default function StakingBalanceService(apiKey, apiSecret) {

   const connection = new BinanceConnection(apiKey, apiSecret)
   const gatewayConnection = new BinanceGatewayConnection()


   this.fetchStakingBalance = async function () {
      const positions = await connection.fetchStakingPosition()
      return positions
         .reduce((map, position) => {
            map[position.asset] ??= { balance: Big(0), positions: [] }
            map[position.asset].balance = map[position.asset].balance.add(position.amount)
            map[position.asset].positions.push(position)
            return map
         }, {})
   }

   this.fetchStakingProducts = async function () {
      const products = await  gatewayConnection.fetchStakingProducts()
      return products.data.reduce((map, products) => {
         // TODO remove useless info
         map[products.asset] = products.projects
         return map
      }, {})
   }
}
