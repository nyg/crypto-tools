import KrakenAPI from '../../adapters/kraken-api/adapter'
import { mondayWeeks } from '../../adapters/kraken-api/ohlc'
import { hasKrakenError, krakenErrors } from '../../adapters/kraken-api/spot'
import { accountIdFor } from '../../db/entry-key'
import { krakenAccountId } from '../../settings'
import CacheMap from './cache-map'
import type { PortfolioExchange } from './exchange'
import type { HttpRequesterError } from '../../errors'
import type { Credentials } from '../../../types/credentials'
import type { KrakenSpotMarket } from '../../../types/kraken'
import type {
   CandleInterval, ExchangeAccount, LimitOrderRequest, OpenStopOrder, OrderLookup, OrderRequest, OrderSettlement,
   SpotCandle, SpotMarket, SpotPrice, StopOrderRequest, TradeFees, WalletCoin
} from '../../../types/portfolio'

const MARKETS_TTL_MS = 60 * 60 * 1000
const CANDLES_TTL_MS = 5 * 60 * 1000
const POST_ONLY_REFUSED = 'EOrder:Post only order'
const AMBIGUOUS_ERRORS = ['EService:Unavailable', 'EService:Busy', 'EService:Deadline elapsed', 'EGeneral:Internal error']

const markets = new CacheMap<KrakenSpotMarket[]>(MARKETS_TTL_MS)
const dailyCandles = new CacheMap<SpotCandle[]>(CANDLES_TTL_MS)

export default class KrakenExchange implements PortfolioExchange {

   readonly balanceDecimals = 10
   readonly buyFeeInQuote = true
   // A cancel within 15 s of placing counts several times over against the pair's order
   // rate limit, and every QueryOrders counts against the API counter.
   readonly chasePacing = { pollMs: 5000, moveAfterMs: 15000 }

   readonly #api: KrakenAPI
   readonly #apiKey: string

   constructor(credentials: Credentials) {
      this.#api = new KrakenAPI(credentials)
      this.#apiKey = credentials.apiKey
   }

   async account(): Promise<ExchangeAccount> {
      return { accountId: krakenAccountId() || accountIdFor(this.#apiKey), canTrade: true, expiresAt: null }
   }

   wallet(): Promise<WalletCoin[]> {
      return this.#api.fetchSpotWallet()
   }

   markets(): Promise<SpotMarket[]> {
      return this.#markets()
   }

   async prices(): Promise<Record<string, SpotPrice>> {
      return this.#api.fetchSpotPrices(await this.#markets())
   }

   async candles(symbol: string, interval: CandleInterval): Promise<SpotCandle[]> {
      const daily = await dailyCandles.get(symbol, async () => {
         const { altname } = await this.#market(symbol)
         return this.#api.fetchDailyCandles(altname)
      })
      return interval === '1w' ? mondayWeeks(daily) : daily
   }

   async tradeFees(symbols: string[]): Promise<Record<string, TradeFees>> {
      return this.#api.fetchTradeFees((await this.#markets()).filter(({ symbol }) => symbols.includes(symbol)))
   }

   async placeOrder(order: OrderRequest): Promise<string> {
      const { altname } = await this.#market(order.symbol)
      return this.#api.placeMarketOrder(altname, order)
   }

   async placeLimitOrder(order: LimitOrderRequest): Promise<string> {
      const { altname } = await this.#market(order.symbol)
      return this.#api.placeLimitOrder(altname, order)
   }

   cancelOrder(lookup: OrderLookup): Promise<void> {
      return this.#api.cancelOrderIfOpen(lookup)
   }

   async settleOrder(lookup: OrderLookup): Promise<OrderSettlement | null> {
      const { quote } = await this.#market(lookup.symbol)
      return this.#api.fetchSettlement(lookup, quote)
   }

   async placeStopOrder(order: StopOrderRequest): Promise<string> {
      const { altname } = await this.#market(order.symbol)
      return this.#api.placeStopOrder(altname, order)
   }

   cancelStopOrder(lookup: OrderLookup): Promise<void> {
      return this.#api.cancelOrderIfOpen(lookup)
   }

   async openStopOrders(): Promise<OpenStopOrder[]> {
      return this.#api.fetchOpenStops(await this.#markets())
   }

   describeError(error: HttpRequesterError): string {
      const errors = krakenErrors(error)
      return errors.length > 0 ? errors.join(', ') : String(error.cause)
   }

   isAmbiguous(error: HttpRequesterError): boolean {
      return krakenErrors(error).some(message => AMBIGUOUS_ERRORS.includes(message))
   }

   isPostOnlyRefusal(error: HttpRequesterError): boolean {
      return hasKrakenError(error, POST_ONLY_REFUSED)
   }

   #markets(): Promise<KrakenSpotMarket[]> {
      return markets.get('mainnet', () => this.#api.fetchSpotMarkets())
   }

   async #market(symbol: string): Promise<KrakenSpotMarket> {
      const market = (await this.#markets()).find(entry => entry.symbol === symbol)
      if (!market) throw new Error(`Kraken lists no ${symbol} market.`)
      return market
   }
}
