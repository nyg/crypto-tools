import BybitAPI from '../../adapters/bybit-api/adapter'
import CacheMap from './cache-map'
import type { PortfolioExchange } from './exchange'
import type { HttpRequesterError } from '../../errors'
import type { Credentials } from '../../../types/credentials'
import type { BybitEnvironment } from '../../../types/bybit-api'
import type {
   ExchangeAccount, OpenStopOrder, OrderLookup, OrderRequest, OrderSettlement, SpotMarket, SpotPrice,
   StopOrderRequest, WalletCoin
} from '../../../types/portfolio'

const ACCOUNT_TTL_MS = 5 * 60 * 1000
const MARKETS_TTL_MS = 60 * 60 * 1000
const AMBIGUOUS_CODES = [10000, 10016]

const accounts = new CacheMap<ExchangeAccount>(ACCOUNT_TTL_MS)
const markets = new CacheMap<SpotMarket[]>(MARKETS_TTL_MS)

type BybitErrorBody = { retCode?: number, retMsg?: string } | string | undefined

export default class BybitExchange implements PortfolioExchange {

   readonly balanceDecimals = 8

   readonly #api: BybitAPI
   readonly #accountKey: string

   constructor(environment: BybitEnvironment, credentials: Credentials) {
      this.#api = new BybitAPI(environment, credentials)
      this.#accountKey = `${environment}:${credentials.apiKey}`
   }

   account(): Promise<ExchangeAccount> {
      return accounts.get(this.#accountKey, () => this.#api.fetchAccount())
   }

   wallet(): Promise<WalletCoin[]> {
      return this.#api.fetchWallet()
   }

   markets(): Promise<SpotMarket[]> {
      return markets.get('mainnet', () => this.#api.fetchSpotMarkets())
   }

   prices(): Promise<Record<string, SpotPrice>> {
      return this.#api.fetchSpotPrices()
   }

   placeOrder(order: OrderRequest): Promise<string> {
      return this.#api.placeMarketOrder(order)
   }

   settleOrder({ clientOrderId }: OrderLookup): Promise<OrderSettlement | null> {
      return this.#api.fetchSettlement(clientOrderId)
   }

   placeStopOrder(order: StopOrderRequest): Promise<string> {
      return this.#api.placeStopOrder(order)
   }

   cancelStopOrder({ symbol, clientOrderId }: OrderLookup): Promise<void> {
      return this.#api.cancelStopOrder(symbol, clientOrderId)
   }

   openStopOrders(): Promise<OpenStopOrder[]> {
      return this.#api.fetchOpenStops()
   }

   describeError(error: HttpRequesterError): string {
      const body = error.body as BybitErrorBody
      if (typeof body === 'object' && body?.retMsg) return `${body.retMsg} (${body.retCode})`
      return String(error.cause)
   }

   isAmbiguous(error: HttpRequesterError): boolean {
      const body = error.body as BybitErrorBody
      return typeof body === 'object' && AMBIGUOUS_CODES.includes(body?.retCode ?? -1)
   }
}
