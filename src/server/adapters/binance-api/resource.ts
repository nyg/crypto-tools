import { httpRequester } from '../http-requester/server-http-requester'
import { pacer } from '../http-requester/pacer'
import { authenticator } from './authenticator'
import type { Credentials } from '../../../types/credentials'
import type {
   BinanceAccount, BinanceBookTicker, BinanceCommission, BinanceDeposit, BinanceEnvironment, BinanceExchangeInfo,
   BinanceFiatFunding, BinanceHistoryParams, BinanceKLine, BinanceOrder, BinanceOrderAck, BinanceOrderParams,
   BinanceOrderReference, BinanceSpotBalance, BinanceStakingPosition, BinanceTickerPrice, BinanceTrade,
   BinanceWithdrawal
} from '../../../types/binance-api'

const hosts: Record<BinanceEnvironment, string> = {
   mainnet: 'https://api.binance.com',
   testnet: 'https://testnet.binance.vision'
}

const urlFor = (endpoint: string, environment: BinanceEnvironment = 'mainnet') => hosts[environment] + endpoint

const exchangeInfoEndpoint = '/api/v3/exchangeInfo'
const tickerPriceEndpoint = '/api/v3/ticker/price'
const bookTickerEndpoint = '/api/v3/ticker/bookTicker'
const klinesEndpoint = '/api/v3/klines' // candlestick data

const accountEndpoint = '/api/v3/account'
const commissionEndpoint = '/api/v3/account/commission'
const orderEndpoint = '/api/v3/order'
const openOrdersEndpoint = '/api/v3/openOrders'
const myTradesEndpoint = '/api/v3/myTrades'

const userAssetEndpoint = '/sapi/v3/asset/getUserAsset'
const fiatFundingEndpoint = '/sapi/v1/fiat/orders'
const stakingPositionEndpoint = '/sapi/v1/staking/position'
const depositHistoryEndpoint = '/sapi/v1/capital/deposit/hisrec'
const withdrawHistoryEndpoint = '/sapi/v1/capital/withdraw/history'

// Each of these endpoints has its own budget of 180000 weight a minute per account:
// a withdrawal history call costs 18000 of it and a fiat orders call 45000.
const paceWithdrawHistory = pacer(6500)
const paceFiatFunding = pacer(16000)

/* Public endpoints */

export async function fetchExchangeInfo(
   environment: BinanceEnvironment = 'mainnet', searchParams: Record<string, unknown> = {}
): Promise<BinanceExchangeInfo> {
   return await httpRequester.public<BinanceExchangeInfo>(urlFor(exchangeInfoEndpoint, environment), searchParams)
}

export async function fetchAllTickerPrices(environment: BinanceEnvironment): Promise<BinanceTickerPrice[]> {
   return await httpRequester.public<BinanceTickerPrice[]>(urlFor(tickerPriceEndpoint, environment))
}

export async function fetchBookTickers(environment: BinanceEnvironment): Promise<BinanceBookTicker[]> {
   return await httpRequester.public<BinanceBookTicker[]>(urlFor(bookTickerEndpoint, environment))
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

export async function fetchRecentKLines(symbol: string, interval: string, limit: number): Promise<BinanceKLine[]> {
   return await httpRequester.public<BinanceKLine[]>(urlFor(klinesEndpoint), { symbol, interval, limit })
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
   await paceFiatFunding()
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

export async function fetchDepositHistory(apiCredentials: Credentials, params: BinanceHistoryParams): Promise<BinanceDeposit[]> {
   return await httpRequester.private<BinanceDeposit[]>(
      urlFor(depositHistoryEndpoint),
      authenticator(apiCredentials),
      { searchParams: { ...params } })
}

export async function fetchWithdrawHistory(apiCredentials: Credentials, params: BinanceHistoryParams): Promise<BinanceWithdrawal[]> {
   await paceWithdrawHistory()
   return await httpRequester.private<BinanceWithdrawal[]>(
      urlFor(withdrawHistoryEndpoint),
      authenticator(apiCredentials),
      { searchParams: { ...params } })
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

/* Spot trading endpoints, on mainnet or the spot testnet */

const tradingRequest = <T>(
   environment: BinanceEnvironment, apiCredentials: Credentials, endpoint: string,
   method: string, searchParams: object
) => httpRequester.private<T>(
   urlFor(endpoint, environment), authenticator(apiCredentials),
   { method, searchParams: searchParams as Record<string, unknown> })

export async function fetchAccount(environment: BinanceEnvironment, apiCredentials: Credentials): Promise<BinanceAccount> {
   return await tradingRequest(environment, apiCredentials, accountEndpoint, 'GET', { omitZeroBalances: true })
}

export async function fetchCommission(environment: BinanceEnvironment, apiCredentials: Credentials, symbol: string): Promise<BinanceCommission> {
   return await tradingRequest(environment, apiCredentials, commissionEndpoint, 'GET', { symbol })
}

export async function createOrder(environment: BinanceEnvironment, apiCredentials: Credentials, order: BinanceOrderParams): Promise<BinanceOrderAck> {
   return await tradingRequest(environment, apiCredentials, orderEndpoint, 'POST', order)
}

export async function fetchOrder(environment: BinanceEnvironment, apiCredentials: Credentials, reference: BinanceOrderReference): Promise<BinanceOrder> {
   return await tradingRequest(environment, apiCredentials, orderEndpoint, 'GET', reference)
}

export async function cancelOrder(environment: BinanceEnvironment, apiCredentials: Credentials, reference: BinanceOrderReference): Promise<BinanceOrder> {
   return await tradingRequest(environment, apiCredentials, orderEndpoint, 'DELETE', reference)
}

export async function fetchOpenOrders(environment: BinanceEnvironment, apiCredentials: Credentials): Promise<BinanceOrder[]> {
   return await tradingRequest(environment, apiCredentials, openOrdersEndpoint, 'GET', {})
}

export async function fetchOrderTrades(
   environment: BinanceEnvironment, apiCredentials: Credentials, { symbol, orderId }: { symbol: string, orderId: number }
): Promise<BinanceTrade[]> {
   return await tradingRequest(environment, apiCredentials, myTradesEndpoint, 'GET', { symbol, orderId })
}
