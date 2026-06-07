import Big from 'big.js'
import * as resource from './resource'


export default function BinanceAPI(credentials) {

   this.fetchTradingPairs = async function () {
      const response = await resource.fetchExchangeInfo()
      return response.symbols
         .map(pair => ({
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
         .reduce((pairs, pair) => {
            pairs[pair.id] = pair
            return pairs
         }, {})
   }

   this.fetchRates = async function (pairs) {
      const response = await resource.fetchTickerPrice(pairs)
      return response.reduce((rates, ticker) => {
         rates[ticker.symbol] = Big(ticker.price)
         return rates
      }, {})
   }

   this.fetchCandlestickData = async function (symbol, interval, startTime, endTime, limit) {
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

   this.fetchBalances = async function () {
      const response = await resource.fetchSpotBalance(credentials)
      return response.reduce((balances, balance) => {
         balances[balance.asset] = {
            asset: balance.asset,
            free: Big(balance.free),
            locked: Big(balance.locked)
         }
         return balances
      }, {})
   }

   this.fetchStakingBalances = async function () {
      const response = await resource.fetchStakingPositions(credentials)
      return response.reduce((positions, position) => {
         positions[position.asset] ??= { balance: Big(0), positions: [] }
         positions[position.asset].balance = positions[position.asset].balance.add(position.amount)
         positions[position.asset].positions.push({
            id: position.positionId,
            asset: position.asset,
            apy: position.apy,
            amount: Big(position.amount),
            duration: position.duration,
            endDate: position.deliverDate
         })
         return positions
      }, {})
   }

   this.fetchFiatDeposits = async function (fromDate, toDate) {

      let hasNext = true, pageIndex = 1, fetchedDepositCount = 0
      const deposits = []

      while (hasNext) {
         const response = await resource.fetchFiatFunding(
            credentials,
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
