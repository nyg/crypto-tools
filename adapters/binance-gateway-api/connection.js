import { httpRequester } from './requester'


function BinanceGatewayConnection() {

   const apiUrl = 'https://www.binance.com/bapi/earn'
   const stakingProductsEndpoint = '/v1/friendly/finance-earn/simple/product/simpleEarnProducts'


   this.fetchStakingProducts = async function () {
      return await httpRequester.execute(urlFor(stakingProductsEndpoint), {
         pageIndex: 1,
         pageSize: 500,
         simpleEarnType: 'FIXED'
      })
   }


   function urlFor(endpoint) {
      return apiUrl + endpoint
   }
}

export const binanceGatewayConnection = new BinanceGatewayConnection()
