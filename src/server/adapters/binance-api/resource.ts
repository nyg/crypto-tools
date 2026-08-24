import { httpRequester } from '../http-requester/server-http-requester'
import { authenticator } from './authenticator'
import type { Credentials } from '../../../types/credentials'
import type {
   BinanceExchangeInfo, BinanceFiatFunding, BinanceKLine, BinanceSpotBalance,
   BinanceStakingPosition, BinanceTickerPrice
} from '../../../types/binance-api'

const apiUrl = 'https://api.binance.com'
const urlFor = (endpoint: string) => apiUrl + endpoint

const exchangeInfoEndpoint = '/api/v3/exchangeInfo'
const tickerPriceEndpoint = '/api/v3/ticker/price'
const klinesEndpoint = '/api/v3/klines' // candlestick data

const userAssetEndpoint = '/sapi/v3/asset/getUserAsset'
const fiatFundingEndpoint = '/sapi/v1/fiat/orders'
const stakingPositionEndpoint = '/sapi/v1/staking/position'

/* Public endpoints */

export async function fetchExchangeInfo(): Promise<BinanceExchangeInfo> {
   return await httpRequester.public<BinanceExchangeInfo>(urlFor(exchangeInfoEndpoint))
}

export async function fetchTickerPrice(pairs: string[]): Promise<BinanceTickerPrice[]> {
   return await httpRequester.public<BinanceTickerPrice[]>(
      urlFor(tickerPriceEndpoint),
      { symbols: JSON.stringify(pairs) })
}

export async function fetchKLines(symbol: string, interval: string, startTime: number, endTime: number, limit: number): Promise<BinanceKLine[]> {
   return await httpRequester.public<BinanceKLine[]>(
      urlFor(klinesEndpoint),
      { symbol, interval, startTime, endTime, limit })
}

interface FiatFundingParams {
   transactionType: number
   fromDate: number
   toDate: number
   pageIndex?: number
   pageSize?: number
}

/* Private endpoints */

export async function fetchSpotBalance(apiCredentials: Credentials): Promise<BinanceSpotBalance[]> {
   return await httpRequester.private<BinanceSpotBalance[]>(
      urlFor(userAssetEndpoint),
      authenticator(apiCredentials),
      { method: 'POST' })
}

export async function fetchFiatFunding(apiCredentials: Credentials, { transactionType, fromDate, toDate, pageIndex = 1, pageSize = 500 }: FiatFundingParams): Promise<BinanceFiatFunding> {
   return await httpRequester.private<BinanceFiatFunding>(
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
export async function fetchStakingPositions(apiCredentials: Credentials): Promise<BinanceStakingPosition[]> {

   const searchParams = {
      product: 'STAKING',
      current: 1,
      size: 100
   }

   let hasNext
   let positions: BinanceStakingPosition[] = []

   do {
      const response = await httpRequester.private<BinanceStakingPosition[]>(
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
