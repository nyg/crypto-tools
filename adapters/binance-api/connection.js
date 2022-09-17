import { httpRequester } from './requester'


function BinanceConnection() {

   const apiUrl = 'https://api.binance.com'


   /* Public Endpoints */

   const systemStatusEndpoint = '/sapi/v1/system/status'
   const exchangeInfoEndpoint = '/api/v3/exchangeInfo'
   const tickerPriceEndpoint = '/api/v3/ticker/price'


   this.fetchSystemStatus = async function () {
      return await httpRequester.public(urlFor(systemStatusEndpoint))
   }

   this.fetchExchangeInfo = async function () {
      return await httpRequester.public(urlFor(exchangeInfoEndpoint))
   }

   this.fetchTickerPrice = async function (pairs) {
      return await httpRequester.public(urlFor(tickerPriceEndpoint), {
         symbols: JSON.stringify(pairs)
      })
   }


   /* Private Endpoints */

   const spotBalanceEndpoint = '/sapi/v3/asset/getUserAsset'
   const stakingPositionsEndpoint = '/sapi/v1/staking/position'


   this.fetchSpotBalance = async function (apiCredentials) {
      return await httpRequester.private({
         method: 'POST',
         url: urlFor(spotBalanceEndpoint),
         ...apiCredentials
      })
   }

   /** Retrieves locked staking positions, ignore flexible and locked DeFi. */
   this.fetchStakingPositions = async function (apiCredentials) {

      const config = {
         url: urlFor(stakingPositionsEndpoint),
         ...apiCredentials
      }

      const params = {
         product: 'STAKING',
         current: 1,
         size: 100
      }

      let hasNext
      let positions = []

      do {
         positions = positions.concat(await httpRequester.private(config, params))

         hasNext = positions.length === params.size
         params.current++
      }
      while (hasNext)

      return positions
   }


   function urlFor(endpoint) {
      return apiUrl + endpoint
   }
}

export const binanceConnection = new BinanceConnection()
