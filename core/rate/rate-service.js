import Big from 'big.js'
import BinanceConnection from '../../adapters/binance-api/connection.js'
import MarketService from '../market/market-service.js'
import { findPath } from 'modern-dijkstra'


export default function RateService(apiKey, apiSecret) {

   const connection = new BinanceConnection(apiKey, apiSecret)
   const marketService = new MarketService()

   const referenceAsset = 'USDT'

   let graph = undefined

   this.fetchRates = async function (assets) {

      assets = assets.filter(asset => asset !== referenceAsset)

      /* Trading pairs */

      if (graph === undefined) {

         console.log('Graph is undefined, building…')

         const tradingPairs = await marketService.fetchTradingPairs()
         const quoteAssetsFrequency = tradingPairs
            .map(pair => pair.quote)
            .reduce((quoteAssets, asset) => {
               quoteAssets[asset] ??= 0
               quoteAssets[asset] += 1
               return quoteAssets
            }, {})

         quoteAssetsFrequency[referenceAsset] *= 10

         function buildGraph(tradingPairs) {
            return tradingPairs
               .reduce((graph, pair) => {
                  graph[pair.base] ??= {}
                  graph[pair.base][pair.quote] = tradingPairWeight(pair, quoteAssetsFrequency)
                  return graph
               }, {})
         }

         graph = buildGraph(tradingPairs)
      }

      const paths = assets
         .map(asset => findPath(graph, asset, referenceAsset))
         .reduce((paths, path) => {
            paths[path[0]] ??= tradingPairsFrom(path)
            return paths
         }, {})

      const pairs = [...new Set(Object.values(paths).flatMap(x => x))]
      let rates = await connection.fetchTickerPrice(pairs)
      if (!Array.isArray(rates)) {
         throw Error(`Error fetching rates: ${rates}`)
      }

      rates = rates.reduce((rates, ticker) => {
         rates[ticker.symbol] = Big(ticker.price)
         return rates
      }, {})

      return assets.reduce((prices, asset) => {
         prices[asset] = paths[asset].map(pair => rates[pair]).reduce((acc, val) => acc.times(val))
         return prices
      }, { [referenceAsset]: 1 })
   }

   function tradingPairsFrom(path) {
      return path.reduce((pairs, quote, index) => {

         if (index != 0) {
            pairs.push(`${path[index - 1]}${quote}`)
         }

         return pairs
      }, [])
   }

   function tradingPairWeight(pair, quoteAssetsFrequency) {
      return 1 / ((quoteAssetsFrequency[pair.base] ?? 0) + (quoteAssetsFrequency[pair.quote] ?? 0))
   }
}
