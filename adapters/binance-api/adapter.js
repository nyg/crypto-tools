import { fetchExchangeInfo, fetchFiatFunding, fetchKLines, fetchSpotBalance, fetchTickerPrice } from './resource'

export default function BinanceAPI(credentials) {

   this.fetchTradingPairs = async function () {
      const response = await fetchExchangeInfo()
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
      const response = await fetchTickerPrice(pairs)
      return response.reduce((rates, ticker) => {
         rates[ticker.symbol] = ticker.price
         return rates
      }, {})
   }

   this.fetchCandlestickData = async function (symbol, interval, startTime, endTime, limit) {
      const response = await fetchKLines(symbol, interval, startTime, endTime, limit)
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
      const response = await fetchSpotBalance()
      response.reduce((balances, balance) => {
         balances[balance.asset] = {
            asset: balance.asset,
            free: balance.free,
            locked: balance.locked
         }
         return balances
      })
   }

   this.fetchFiatDeposits = async function (fromDate, toDate) {

      let hasNext = true, pageIndex = 1, fetchedDepositCount = 0
      const deposits = []

      while (hasNext) {
         const response = await fetchFiatFunding(
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
