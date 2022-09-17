import { httpRequester } from './requester'


function BinanceGatewayConnection() {

   const apiUrl = 'https://www.binance.com/gateway-api'
   const stakingProductsEndpoint = '/v1/friendly/pos/union'


   this.fetchStakingProducts = async function () {
      return await httpRequester.execute(urlFor(stakingProductsEndpoint), {
         status: 'ALL',
         pageSize: 200
      })
   }


   function urlFor(endpoint) {
      return apiUrl + endpoint
   }
}

export const binanceGatewayConnection = new BinanceGatewayConnection()
