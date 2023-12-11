import { httpRequester } from '../http-requester/server-http-requester'
import { authenticator } from './authenticator'


function BinanceConnection() {

   const apiUrl = 'https://api.binance.com'


   /* Public endpoints */

   const systemStatusEndpoint = '/sapi/v1/system/status'
   const exchangeInfoEndpoint = '/api/v3/exchangeInfo'
   const tickerPriceEndpoint = '/api/v3/ticker/price'
   const klinesEndpoint = '/api/v3/klines' // candlestick data


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
      const params = { symbol, interval, startTime, endTime, limit }
      return await httpRequester.public(urlFor(klinesEndpoint), params)
   }


   /* Private endpoints */

   const userAssetEndpoint = '/sapi/v3/asset/getUserAsset'
   const fiatFundingEndpoint = '/sapi/v1/fiat/orders'
   const stakingPositionsEndpoint = '/sapi/v1/staking/position'


   this.fetchSpotBalance = async function (apiCredentials) {
      return await httpRequester.private(
         urlFor(userAssetEndpoint),
         authenticator(apiCredentials),
         { method: 'POST' })
   }

   this.fetchFiatDeposits = async function (apiCredentials) {

      const computeEndTime = beginTime => beginTime + 90 * 24 * 3600 * 1000

      let beginTime = new Date('2020-12-01').getTime()
      let endTime = computeEndTime(beginTime)

      let searchParams = {
         transactionType: 0,
         beginTime,
         endTime
      }

      let hasNext
      let deposits = []

      const delay = (ms = 1000) => new Promise((r) => setTimeout(r, ms))

      do {
         console.log('Fetching deposits with', searchParams)
         const response = await httpRequester.private(
            urlFor(fiatFundingEndpoint),
            authenticatorFor(apiCredentials),
            { searchParams })

         console.log(`Got ${response.data.length} deposits`)
         deposits = deposits.concat(response.data)

         beginTime = endTime + 1
         endTime = computeEndTime(beginTime)

         hasNext = endTime < new Date().getTime()
         searchParams = { ...searchParams, beginTime, endTime }

         await delay(35000)
      }
      while (hasNext)

      return deposits
   }

   /** Retrieves locked staking positions, ignores flexible and locked DeFi. */
   this.fetchStakingPositions = async function (apiCredentials) {

      const searchParams = {
         product: 'STAKING',
         current: 1,
         size: 100
      }

      let hasNext
      let positions = []

      do {
         const response = await httpRequester.private(
            urlFor(stakingPositionsEndpoint),
            authenticator(apiCredentials),
            { searchParams })

         positions = positions.concat(response)

         hasNext = positions.length === searchParams.size
         searchParams.current++
      }
      while (hasNext)

      return positions
   }


   /* Private functions */

   function urlFor(endpoint) {
      return apiUrl + endpoint
   }
}

export const binanceConnection = new BinanceConnection()
