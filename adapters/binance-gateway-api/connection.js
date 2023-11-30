import { httpRequester } from '../http-requester/http-requester'


function BinanceGatewayConnection() {

   const apiUrl = 'https://www.binance.com/bapi/earn'
   const stakingProductsEndpoint = '/v1/friendly/finance-earn/simple/product/simpleEarnProducts'

   this.fetchStakingProducts = async function () {
      const params = { pageIndex: 1, pageSize: 500, simpleEarnType: 'FIXED' }
      return await httpRequester.public(urlFor(stakingProductsEndpoint), params)
   }

   function urlFor(endpoint) {
      return apiUrl + endpoint
   }
}

export const binanceGatewayConnection = new BinanceGatewayConnection()
