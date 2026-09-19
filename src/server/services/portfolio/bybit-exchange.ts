import BybitAPI from '../../adapters/bybit-api/adapter'
import type { PortfolioExchange } from './exchange'
import type { Credentials } from '../../../types/credentials'
import type { BybitEnvironment } from '../../../types/bybit-api'
import type {
   ExchangeAccount, OrderRequest, OrderSettlement, SpotMarket, SpotPrice, WalletCoin
} from '../../../types/portfolio'

const ACCOUNT_TTL_MS = 5 * 60 * 1000
const MARKETS_TTL_MS = 60 * 60 * 1000

interface Cached<T> { value: Promise<T>, expiresAt: number }

const accounts = new Map<string, Cached<ExchangeAccount>>()
let markets: Cached<SpotMarket[]> | null = null

function cached<T>(entry: Cached<T> | null | undefined, ttl: number, load: () => Promise<T>): Cached<T> {
   if (entry && entry.expiresAt > Date.now()) return entry
   const value = load()
   const fresh = { value, expiresAt: Date.now() + ttl }
   value.catch(() => { fresh.expiresAt = 0 })
   return fresh
}

export default class BybitExchange implements PortfolioExchange {

   readonly balanceDecimals = 8

   readonly #api: BybitAPI
   readonly #accountKey: string

   constructor(environment: BybitEnvironment, credentials: Credentials) {
      this.#api = new BybitAPI(environment, credentials)
      this.#accountKey = `${environment}:${credentials.apiKey}`
   }

   account(): Promise<ExchangeAccount> {
      const entry = cached(accounts.get(this.#accountKey), ACCOUNT_TTL_MS, () => this.#api.fetchAccount())
      accounts.set(this.#accountKey, entry)
      return entry.value
   }

   wallet(): Promise<WalletCoin[]> {
      return this.#api.fetchWallet()
   }

   markets(): Promise<SpotMarket[]> {
      markets = cached(markets, MARKETS_TTL_MS, () => this.#api.fetchSpotMarkets())
      return markets.value
   }

   prices(): Promise<Record<string, SpotPrice>> {
      return this.#api.fetchSpotPrices()
   }

   placeOrder(order: OrderRequest): Promise<string> {
      return this.#api.placeMarketOrder(order)
   }

   settleOrder(clientOrderId: string): Promise<OrderSettlement | null> {
      return this.#api.fetchSettlement(clientOrderId)
   }
}
