import Big from 'big.js'
import * as resource from './resource'
import type { Credentials } from '../../../types/credentials'
import type { TradingPair, TradingPairs } from '../../../types/market'
import type {
   Candlestick, FiatDeposit, PairRates, SpotBalances, StakingBalances
} from '../../../types/binance'


export default class BinanceAPI {

   readonly #credentials: Credentials | undefined

   constructor(credentials?: Credentials) {
      this.#credentials = credentials
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
         positions[position.asset] ??= { balance: Big(0), positions: [] }
         positions[position.asset].balance = positions[position.asset].balance.add(position.amount)
         positions[position.asset].positions.push({
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
}
