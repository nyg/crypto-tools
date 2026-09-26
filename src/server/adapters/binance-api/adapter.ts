import Big from 'big.js'
import * as resource from './resource'
import { usdRatesFromKLines } from './klines'
import {
   hasBinanceCode, openStops, settlementOf, spotAccount, spotMarkets, spotPrices, spotWallet, takerFee
} from './spot'
import type { Credentials } from '../../../types/credentials'
import type { TradingPair, TradingPairs } from '../../../types/market'
import type {
   Candlestick, FiatDeposit, PairRates, SpotBalances, StakingBalances
} from '../../../types/binance'
import type { BinanceEnvironment } from '../../../types/binance-api'
import type { UsdRateRow } from '../../../types/db'
import type {
   ExchangeAccount, OpenStopOrder, OrderLookup, OrderRequest, OrderSettlement, SpotMarket, SpotPrice,
   StopOrderRequest, TakerFee, WalletCoin
} from '../../../types/portfolio'

const UNKNOWN_ORDER = -2011
const NO_SUCH_ORDER = -2013

const DAY_MS = 86400000

const KLINE_LIMIT = 1000

export default class BinanceAPI {

   readonly #credentials: Credentials | undefined
   readonly #environment: BinanceEnvironment

   constructor(credentials?: Credentials, environment: BinanceEnvironment = 'mainnet') {
      this.#credentials = credentials
      this.#environment = environment
   }

   // Every private call needs credentials; a BinanceAPI built without them is only
   // good for the public endpoints, and asking it for a balance is a programming error.
   get #authenticated(): Credentials {
      if (!this.#credentials) throw new Error('This Binance call needs API credentials.')
      return this.#credentials
   }

   async fetchTradingPairs(): Promise<TradingPairs> {
      const response = await resource.fetchExchangeInfo()
      return response.symbols
         .map((pair): TradingPair => ({
            id: pair.symbol,
            name: `${pair.baseAsset}/${pair.quoteAsset}`,
            base: {
               name: pair.baseAsset,
               decimals: pair.baseAssetPrecision,
            },
            quote: {
               name: pair.quoteAsset,
               decimals: pair.quoteAssetPrecision,
            }
         }))
         .reduce<TradingPairs>((pairs, pair) => {
            pairs[pair.id] = pair
            return pairs
         }, {})
   }

   async fetchRates(pairs: string[]): Promise<PairRates> {
      const response = await resource.fetchTickerPrice(pairs)
      return response.reduce<PairRates>((rates, ticker) => {
         rates[ticker.symbol] = Big(ticker.price)
         return rates
      }, {})
   }

   async fetchUsdRateHistory({ asset, symbol, from, to, today }: {
      asset: string
      symbol: string
      from: number
      to: number
      today: number
   }): Promise<UsdRateRow[]> {

      const rows: UsdRateRow[] = []
      let startTime = from

      while (startTime <= to) {
         const klines = await resource.fetchKLines(symbol, '1d', startTime, to + DAY_MS - 1, KLINE_LIMIT)
         rows.push(...usdRatesFromKLines({ asset, klines, today }))
         const last = klines.at(-1)?.[0]
         if (klines.length < KLINE_LIMIT || last === undefined) break
         startTime = last + DAY_MS
      }

      return rows
   }

   async fetchCandlestickData(
      symbol: string, interval: string, startTime: number, endTime: number, limit: number
   ): Promise<Candlestick[]> {
      const response = await resource.fetchKLines(symbol, interval, startTime, endTime, limit)
      return response.map(candlestick => ({
         timestamp: {
            open: candlestick[0],
            close: candlestick[6]
         },
         open: candlestick[1],
         high: candlestick[2],
         low: candlestick[3],
         close: candlestick[4],
         volume: {
            base: candlestick[5],
            quote: candlestick[7]
         },
         tradeCount: candlestick[8]
      }))
   }

   async fetchBalances(): Promise<SpotBalances> {
      const response = await resource.fetchSpotBalance(this.#authenticated)
      return response.reduce<SpotBalances>((balances, balance) => {
         balances[balance.asset] = {
            asset: balance.asset,
            free: Big(balance.free),
            locked: Big(balance.locked)
         }
         return balances
      }, {})
   }

   async fetchStakingBalances(): Promise<StakingBalances> {
      const response = await resource.fetchStakingPositions(this.#authenticated)
      return response.reduce<StakingBalances>((positions, position) => {
         const held = positions[position.asset] ??= { balance: Big(0), positions: [] }
         held.balance = held.balance.add(position.amount)
         held.positions.push({
            id: position.positionId,
            asset: position.asset,
            apy: position.apy,
            amount: Big(position.amount),
            duration: position.duration,
            accrualDays: position.accrualDays,
            endDate: position.deliverDate
         })
         return positions
      }, {})
   }

   async fetchFiatDeposits(fromDate: number, toDate: number): Promise<FiatDeposit[]> {

      let hasNext = true, pageIndex = 1, fetchedDepositCount = 0
      const deposits: FiatDeposit[] = []

      while (hasNext) {
         const response = await resource.fetchFiatFunding(
            this.#authenticated,
            { transactionType: 0, fromDate, toDate, pageIndex })

         fetchedDepositCount += response.data.length
         hasNext = fetchedDepositCount < response.total
         pageIndex += 1

         // TODO data
         deposits.push(...response.data)
      }

      return deposits
   }

   /* Spot trading for portfolios */

   async fetchSpotMarkets(): Promise<SpotMarket[]> {
      return spotMarkets(await resource.fetchExchangeInfo(this.#environment, { symbolStatus: 'TRADING' }))
   }

   async fetchSpotPrices(): Promise<Record<string, SpotPrice>> {
      const [tickers, books] = await Promise.all([
         resource.fetchAllTickerPrices(this.#environment), resource.fetchBookTickers(this.#environment)])
      return spotPrices(tickers, books)
   }

   async fetchSpotAccount(fallbackId: string): Promise<ExchangeAccount> {
      return spotAccount(await resource.fetchAccount(this.#environment, this.#authenticated), fallbackId)
   }

   async fetchTakerFee(symbol: string): Promise<TakerFee> {
      return takerFee(await resource.fetchCommission(this.#environment, this.#authenticated, symbol))
   }

   async fetchSpotWallet(): Promise<WalletCoin[]> {
      return spotWallet(await resource.fetchAccount(this.#environment, this.#authenticated))
   }

   async placeMarketOrder({ clientOrderId, symbol, side, unit, amount }: OrderRequest): Promise<string> {
      const { orderId } = await resource.createOrder(this.#environment, this.#authenticated, {
         symbol,
         side: side === 'buy' ? 'BUY' : 'SELL',
         type: 'MARKET',
         ...(unit === 'base' ? { quantity: amount } : { quoteOrderQty: amount }),
         newClientOrderId: clientOrderId,
         newOrderRespType: 'ACK'
      })
      return String(orderId)
   }

   async placeStopOrder({ clientOrderId, symbol, quantity, triggerPrice }: StopOrderRequest): Promise<string> {
      const { orderId } = await resource.createOrder(this.#environment, this.#authenticated, {
         symbol,
         side: 'SELL',
         type: 'STOP_LOSS',
         quantity,
         stopPrice: triggerPrice,
         newClientOrderId: clientOrderId,
         newOrderRespType: 'ACK'
      })
      return String(orderId)
   }

   async cancelOrderIfOpen({ symbol, clientOrderId }: OrderLookup): Promise<void> {
      try {
         await resource.cancelOrder(this.#environment, this.#authenticated, { symbol, origClientOrderId: clientOrderId })
      }
      catch (error) {
         if (!hasBinanceCode(error, UNKNOWN_ORDER)) throw error
      }
   }

   async fetchOpenStops(): Promise<OpenStopOrder[]> {
      return openStops(await resource.fetchOpenOrders(this.#environment, this.#authenticated))
   }

   async fetchSettlement({ symbol, clientOrderId }: OrderLookup): Promise<OrderSettlement | null> {

      let order
      try {
         order = await resource.fetchOrder(this.#environment, this.#authenticated, { symbol, origClientOrderId: clientOrderId })
      }
      catch (error) {
         if (hasBinanceCode(error, NO_SUCH_ORDER)) return null
         throw error
      }

      const settled = settlementOf(order, [])
      if (settled.status === 'open' || Big(settled.base).eq(0)) return settled

      const trades = await resource.fetchOrderTrades(this.#environment, this.#authenticated, { symbol, orderId: order.orderId })
      return settlementOf(order, trades)
   }
}
