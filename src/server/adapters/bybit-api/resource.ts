import { httpRequester } from '../http-requester/server-http-requester'
import { authenticator } from './authenticator'
import { HttpRequesterError } from '../../errors'
import type { Credentials } from '../../../types/credentials'
import type {
   BybitApiKeyInfo, BybitCancelRequest, BybitEnvironment, BybitExecution, BybitOrder,
   BybitOrderCancelled, BybitOrderCreated, BybitOrderRequest, BybitPage, BybitResponse,
   BybitSpotInstrument, BybitSpotTicker, BybitWalletAccount
} from '../../../types/bybit-api'

const hosts: Record<BybitEnvironment, string> = {
   mainnet: 'https://api.bybit.com',
   demo: 'https://api-demo.bybit.com'
}

const marketHost = hosts.mainnet
const TIMEOUT_MS = 15000

const instrumentsEndpoint = '/v5/market/instruments-info'
const tickersEndpoint = '/v5/market/tickers'

const walletBalanceEndpoint = '/v5/account/wallet-balance'
const apiKeyInfoEndpoint = '/v5/user/query-api'
const createOrderEndpoint = '/v5/order/create'
const cancelOrderEndpoint = '/v5/order/cancel'
const realtimeOrdersEndpoint = '/v5/order/realtime'
const orderHistoryEndpoint = '/v5/order/history'
const executionsEndpoint = '/v5/execution/list'

function unwrap<T>(response: BybitResponse<T>): T {
   if (response.retCode !== 0) {
      throw new HttpRequesterError(200, { retCode: response.retCode, retMsg: response.retMsg })
   }
   return response.result
}

const publicRequest = async <T>(endpoint: string, searchParams: Record<string, unknown>) =>
   unwrap(await httpRequester.public<BybitResponse<T>>(marketHost + endpoint, searchParams))

const privateRequest = async <T>(
   environment: BybitEnvironment, credentials: Credentials, endpoint: string,
   { searchParams, bodyParams }: { searchParams?: Record<string, unknown>, bodyParams?: object } = {}
) => unwrap(await httpRequester.private<BybitResponse<T>>(
   hosts[environment] + endpoint, authenticator(credentials),
   { method: bodyParams ? 'POST' : 'GET', searchParams, bodyParams, timeoutMs: TIMEOUT_MS }))

/* Public endpoints */

export async function fetchSpotInstruments(): Promise<BybitSpotInstrument[]> {

   const instruments: BybitSpotInstrument[] = []
   let cursor: string | undefined

   do {
      const page = await publicRequest<BybitPage<BybitSpotInstrument>>(
         instrumentsEndpoint, { category: 'spot', limit: 1000, ...(cursor ? { cursor } : {}) })
      instruments.push(...page.list)
      cursor = page.nextPageCursor || undefined
   } while (cursor)

   return instruments
}

export async function fetchSpotTickers(): Promise<BybitSpotTicker[]> {
   const page = await publicRequest<BybitPage<BybitSpotTicker>>(tickersEndpoint, { category: 'spot' })
   return page.list
}

/* Private endpoints */

export async function fetchUnifiedWallet(
   environment: BybitEnvironment, credentials: Credentials
): Promise<BybitWalletAccount | undefined> {
   const page = await privateRequest<BybitPage<BybitWalletAccount>>(
      environment, credentials, walletBalanceEndpoint, { searchParams: { accountType: 'UNIFIED' } })
   return page.list[0]
}

export async function fetchApiKeyInfo(
   environment: BybitEnvironment, credentials: Credentials
): Promise<BybitApiKeyInfo> {
   return await privateRequest<BybitApiKeyInfo>(environment, credentials, apiKeyInfoEndpoint)
}

export async function createOrder(
   environment: BybitEnvironment, credentials: Credentials, order: BybitOrderRequest
): Promise<BybitOrderCreated> {
   return await privateRequest<BybitOrderCreated>(
      environment, credentials, createOrderEndpoint, { bodyParams: order })
}

export async function cancelOrder(
   environment: BybitEnvironment, credentials: Credentials, request: BybitCancelRequest
): Promise<BybitOrderCancelled> {
   return await privateRequest<BybitOrderCancelled>(
      environment, credentials, cancelOrderEndpoint, { bodyParams: request })
}

export async function fetchOpenStopOrders(
   environment: BybitEnvironment, credentials: Credentials
): Promise<BybitOrder[]> {

   const orders: BybitOrder[] = []
   let cursor: string | undefined

   do {
      const page = await privateRequest<BybitPage<BybitOrder>>(
         environment, credentials, realtimeOrdersEndpoint,
         { searchParams: { category: 'spot', orderFilter: 'StopOrder', limit: 50, cursor } })
      orders.push(...page.list)
      cursor = page.nextPageCursor || undefined
   } while (cursor)

   return orders
}

export async function fetchOrderByLinkId(
   environment: BybitEnvironment, credentials: Credentials, orderLinkId: string
): Promise<BybitOrder | undefined> {

   const searchParams = { category: 'spot', orderLinkId }

   const realtime = await privateRequest<BybitPage<BybitOrder>>(
      environment, credentials, realtimeOrdersEndpoint, { searchParams })
   if (realtime.list.length > 0) return realtime.list[0]

   const conditional = await privateRequest<BybitPage<BybitOrder>>(
      environment, credentials, realtimeOrdersEndpoint,
      { searchParams: { ...searchParams, orderFilter: 'StopOrder' } })
   if (conditional.list.length > 0) return conditional.list[0]

   const history = await privateRequest<BybitPage<BybitOrder>>(
      environment, credentials, orderHistoryEndpoint, { searchParams })
   return history.list[0]
}

export async function fetchExecutions(
   environment: BybitEnvironment, credentials: Credentials, orderId: string
): Promise<BybitExecution[]> {
   const page = await privateRequest<BybitPage<BybitExecution>>(
      environment, credentials, executionsEndpoint,
      { searchParams: { category: 'spot', orderId, limit: 100 } })
   return page.list
}
