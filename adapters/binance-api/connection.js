import { httpRequester } from './requester'


function BinanceConnection() {

   const apiUrl = 'https://api.binance.com'


   /* Public Endpoints */

   const systemStatusEndpoint = '/sapi/v1/system/status'
   const exchangeInfoEndpoint = '/api/v3/exchangeInfo'
   const tickerPriceEndpoint = '/api/v3/ticker/price'
   const klinesEndpoint = '/api/v3/klines'


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

   this.fetchKLines = async function (symbol, interval, startTime, endTime, limit) {
      return await httpRequester.public(urlFor(klinesEndpoint), {
         symbol, interval, startTime, endTime, limit
      })
   }


   /* Private Endpoints */

   const spotBalanceEndpoint = '/sapi/v3/asset/getUserAsset'
   const fiatFundingEndpoint = '/sapi/v1/fiat/orders'
   const stakingPositionsEndpoint = '/sapi/v1/staking/position'


   this.fetchSpotBalance = async function (apiCredentials) {
      return await httpRequester.private({
         method: 'POST',
         url: urlFor(spotBalanceEndpoint),
         ...apiCredentials
      })
   }

   this.fetchFiatDeposits = async function (apiCredentials) {

      const config = {
         url: urlFor(fiatFundingEndpoint),
         ...apiCredentials
      }


      const computeEndTime = beginTime => beginTime + 90 * 24 * 3600 * 1000

      let beginTime = new Date('2020-12-01').getTime()
      let endTime = computeEndTime(beginTime)

      let params = {
         transactionType: 0,
         beginTime,
         endTime
      }

      let hasNext
      let deposits = []

      const delay = (ms = 1000) => new Promise((r) => setTimeout(r, ms))

      do {
         console.log('Fetching deposits with', params)
         const response = await httpRequester.private(config, params)

         console.log(`Got ${response.data.length} deposits`)
         deposits = deposits.concat(response.data)

         beginTime = endTime + 1
         endTime = computeEndTime(beginTime)

         hasNext = endTime < new Date().getTime()

         params = {
            ...params, beginTime, endTime
         }

         await delay(35000)
      }
      while (hasNext)

      return deposits
   }

   /** Retrieves locked staking positions, ignores flexible and locked DeFi. */
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
