import { httpRequester } from '../http-requester/server-http-requester'
import { authenticator } from './authenticator'

const apiUrl = 'https://api.binance.com'
const urlFor = endpoint => apiUrl + endpoint

const exchangeInfoEndpoint = '/api/v3/exchangeInfo'
const tickerPriceEndpoint = '/api/v3/ticker/price'
const klinesEndpoint = '/api/v3/klines' // candlestick data

const userAssetEndpoint = '/sapi/v3/asset/getUserAsset'
const fiatFundingEndpoint = '/sapi/v1/fiat/orders'
const stakingPositionEndpoint = '/sapi/v1/staking/position'

/* Public endpoints */

export async function fetchExchangeInfo() {
   return await httpRequester.public(urlFor(exchangeInfoEndpoint))
}

export async function fetchTickerPrice(pairs) {
   return await httpRequester.public(
      urlFor(tickerPriceEndpoint),
      { searchParams: { symbols: JSON.stringify(pairs) } })
}

export async function fetchKLines(symbol, interval, startTime, endTime, limit) {
   return await httpRequester.public(
      urlFor(klinesEndpoint),
      { searchParams: { symbol, interval, startTime, endTime, limit } })
}

/* Private endpoints */

export async function fetchSpotBalance(apiCredentials) {
   return await httpRequester.private(
      urlFor(userAssetEndpoint),
      authenticator(apiCredentials),
      { method: 'POST' })
}

export async function fetchFiatFunding(apiCredentials, { transactionType, fromDate, toDate, pageIndex = 1, pageSize = 500 }) {
   return await httpRequester.private(
      urlFor(fiatFundingEndpoint),
      authenticator(apiCredentials),
      {
         searchParams: {
            transactionType,
            beginTime: fromDate,
            endTime: toDate,
            page: pageIndex,
            rows: pageSize
         }
      })
}

/** Retrieves locked staking positions, ignores flexible and locked DeFi. */
export async function fetchStakingPositions(apiCredentials) {

   const searchParams = {
      product: 'STAKING',
      current: 1,
      size: 100
   }

   let hasNext
   let positions = []

   do {
      const response = await httpRequester.private(
         urlFor(stakingPositionEndpoint),
         authenticator(apiCredentials),
         { searchParams })

      positions = positions.concat(response)

      hasNext = positions.length === searchParams.size
      searchParams.current++
   }
   while (hasNext)

   return positions
}
