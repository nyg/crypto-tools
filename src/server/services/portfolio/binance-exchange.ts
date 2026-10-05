import BinanceAPI from '../../adapters/binance-api/adapter'
import { binanceError } from '../../adapters/binance-api/spot'
import { accountIdFor } from '../../db/entry-key'
import CacheMap from './cache-map'
import type { PortfolioExchange } from './exchange'
import type { HttpRequesterError } from '../../errors'
import type { Credentials } from '../../../types/credentials'
import type { BinanceEnvironment } from '../../../types/binance-api'
import type {
   CandleInterval, ExchangeAccount, LimitOrderRequest, OpenStopOrder, OrderLookup, OrderRequest, OrderSettlement,
   SpotCandle, SpotMarket, SpotPrice, StopOrderRequest, TradeFees, WalletCoin
} from '../../../types/portfolio'

const ACCOUNT_TTL_MS = 5 * 60 * 1000
const MARKETS_TTL_MS = 60 * 60 * 1000
const FEES_TTL_MS = 10 * 60 * 1000
const CANDLES_TTL_MS = 5 * 60 * 1000
const AMBIGUOUS_CODES = [-1006, -1007]
const ORDER_REJECTED = -2010
const WOULD_TAKE = /immediately match/i

const accounts = new CacheMap<ExchangeAccount>(ACCOUNT_TTL_MS)
const markets = new CacheMap<SpotMarket[]>(MARKETS_TTL_MS)
const fees = new CacheMap<TradeFees>(FEES_TTL_MS)
const candles = new CacheMap<SpotCandle[]>(CANDLES_TTL_MS)

export default class BinanceExchange implements PortfolioExchange {

   readonly balanceDecimals = 8
   readonly buyFeeInQuote = false
   readonly chasePacing = { pollMs: 3000, moveAfterMs: 3000, pollsTakeTurns: false }

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

   candles(symbol: string, interval: CandleInterval): Promise<SpotCandle[]> {
      return candles.get(`${symbol}:${interval}`, () => this.#api.fetchSpotCandles(symbol, interval))
   }

   async tradeFees(symbols: string[]): Promise<Record<string, TradeFees>> {
      const rates = await Promise.all(symbols.map(symbol =>
         fees.get(`${this.#environment}:${this.#apiKey}:${symbol}`, () => this.#api.fetchTradeFees(symbol))))
      return Object.fromEntries(symbols.map((symbol, index) => [symbol, rates[index]!]))
   }

   placeOrder(order: OrderRequest): Promise<string> {
      return this.#api.placeMarketOrder(order)
   }

   placeLimitOrder(order: LimitOrderRequest): Promise<string> {
      return this.#api.placeLimitOrder(order)
   }

   cancelOrder(lookup: OrderLookup): Promise<void> {
      return this.#api.cancelOrderIfOpen(lookup)
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

   isPostOnlyRefusal(error: HttpRequesterError): boolean {
      const body = binanceError(error)
      return body?.code === ORDER_REJECTED && WOULD_TAKE.test(body.msg)
   }
}
