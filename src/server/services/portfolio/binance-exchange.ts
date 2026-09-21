import BinanceAPI from '../../adapters/binance-api/adapter'
import { binanceError } from '../../adapters/binance-api/spot'
import { accountIdFor } from '../../db/entry-key'
import CacheMap from './cache-map'
import type { PortfolioExchange } from './exchange'
import type { HttpRequesterError } from '../../errors'
import type { Credentials } from '../../../types/credentials'
import type { BinanceEnvironment } from '../../../types/binance-api'
import type {
   ExchangeAccount, OpenStopOrder, OrderLookup, OrderRequest, OrderSettlement, SpotMarket, SpotPrice,
   StopOrderRequest, WalletCoin
} from '../../../types/portfolio'

const ACCOUNT_TTL_MS = 5 * 60 * 1000
const MARKETS_TTL_MS = 60 * 60 * 1000
const AMBIGUOUS_CODES = [-1006, -1007]

const accounts = new CacheMap<ExchangeAccount>(ACCOUNT_TTL_MS)
const markets = new CacheMap<SpotMarket[]>(MARKETS_TTL_MS)

export default class BinanceExchange implements PortfolioExchange {

   readonly balanceDecimals = 8

   readonly #api: BinanceAPI
   readonly #environment: BinanceEnvironment
   readonly #apiKey: string

   constructor(environment: BinanceEnvironment, credentials: Credentials) {
      this.#api = new BinanceAPI(credentials, environment)
      this.#environment = environment
      this.#apiKey = credentials.apiKey
   }

   account(): Promise<ExchangeAccount> {
      return accounts.get(`${this.#environment}:${this.#apiKey}`,
         () => this.#api.fetchSpotAccount(accountIdFor(this.#apiKey)))
   }

   wallet(): Promise<WalletCoin[]> {
      return this.#api.fetchSpotWallet()
   }

   markets(): Promise<SpotMarket[]> {
      return markets.get(this.#environment, () => this.#api.fetchSpotMarkets())
   }

   prices(): Promise<Record<string, SpotPrice>> {
      return this.#api.fetchSpotPrices()
   }

   placeOrder(order: OrderRequest): Promise<string> {
      return this.#api.placeMarketOrder(order)
   }

   settleOrder(lookup: OrderLookup): Promise<OrderSettlement | null> {
      return this.#api.fetchSettlement(lookup)
   }

   placeStopOrder(order: StopOrderRequest): Promise<string> {
      return this.#api.placeStopOrder(order)
   }

   cancelStopOrder(lookup: OrderLookup): Promise<void> {
      return this.#api.cancelOrderIfOpen(lookup)
   }

   openStopOrders(): Promise<OpenStopOrder[]> {
      return this.#api.fetchOpenStops()
   }

   describeError(error: HttpRequesterError): string {
      const body = binanceError(error)
      return body ? `${body.msg} (${body.code})` : String(error.cause)
   }

   isAmbiguous(error: HttpRequesterError): boolean {
      return AMBIGUOUS_CODES.includes(binanceError(error)?.code ?? 0)
   }
}
