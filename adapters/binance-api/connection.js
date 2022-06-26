import BinanceRequester from './requester.js'


export default function BinanceConnection(apiKey, apiSecret) {

   const apiUrl = 'https://api.binance.com'
   const requester = new BinanceRequester(apiKey, apiSecret)


   /* Public */

   const systemStatusEndpoint = '/sapi/v1/system/status'
   const exchangeInfoEndpoint = '/api/v3/exchangeInfo'
   const tickerPriceEndpoint = '/api/v3/ticker/price'


   this.fetchSystemStatus = async function () {
      return await requester.public(urlFor(systemStatusEndpoint))
   }

   this.fetchExchangeInfo = async function () {
      return await requester.public(urlFor(exchangeInfoEndpoint))
   }

   this.fetchTickerPrice = async function (pairs) {
      return await requester.public(urlFor(tickerPriceEndpoint), {
         symbols: JSON.stringify(pairs)
      })
   }

   /* Private */

   const accountEndpoint = '/api/v3/account'
   const stakingPositionEndpoint = '/sapi/v1/staking/position'


   this.fetchAccountInformation = async function () {
      return await requester.private(urlFor(accountEndpoint))
   }

   this.fetchStakingPosition = async function () {
      // TODO paging
      return await requester.private(urlFor(stakingPositionEndpoint), {
         product: 'STAKING',
         current: 1,
         size: 100
      })
   }

   function urlFor(endpoint) {
      return apiUrl + endpoint
   }
}
