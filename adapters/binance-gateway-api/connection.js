import BinanceGatewayRequester from './requester.js'


export default function BinanceGatewayConnection() {

   const apiUrl = 'https://www.binance.com/gateway-api'
   const requester = new BinanceGatewayRequester()

   const stakingProductsEndpoint = '/v1/friendly/pos/union'


   this.fetchStakingProducts = async function () {
      return await requester.execute(urlFor(stakingProductsEndpoint), {
         status: 'ALL',
         pageSize: 200
      })
   }


   function urlFor(endpoint) {
      return apiUrl + endpoint
   }
}
