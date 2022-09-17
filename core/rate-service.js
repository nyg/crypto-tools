import Big from 'big.js'
import { findPath } from 'modern-dijkstra'
import { binanceConnection } from '../adapters/binance-api/connection'
import { marketService } from './market-service'


const referenceAsset = 'USDT'

function RateService() {


   this.fetchRates = async function (assets) {

      assets = assets.filter(asset => asset !== referenceAsset)

      const tradingPairs = await marketService.fetchTradingPairs()
      const quoteAssetsFrequency = tradingPairs
         .map(pair => pair.quote)
         .reduce((quoteAssets, asset) => {
            quoteAssets[asset] ??= 0
            quoteAssets[asset] += 1
            return quoteAssets
         }, {})

      quoteAssetsFrequency[referenceAsset] *= 10

      const graph = tradingPairs
         .reduce((graph, pair) => {
            graph[pair.base] ??= {}
            graph[pair.base][pair.quote] = tradingPairWeight(pair, quoteAssetsFrequency)
            return graph
         }, {})

      const paths = assets
         .map(asset => {
            try {
               const path = findPath(graph, asset, referenceAsset)
               return path
            }
            catch (e) {
               console.warn(`Could not find a path for ${asset}`)
               return []
            }
         })
         .reduce((paths, path) => {
            paths[path[0]] ??= tradingPairsFrom(path)
            return paths
         }, {})

      const pairs = [...new Set(Object.values(paths).flatMap(x => x))]
      let rates = await binanceConnection.fetchTickerPrice(pairs)
      if (!Array.isArray(rates)) {
         throw Error(`Error fetching rates: ${rates}`)
      }

      rates = rates.reduce((rates, ticker) => {
         rates[ticker.symbol] = Big(ticker.price)
         return rates
      }, {})

      return assets.reduce((prices, asset) => {
         prices[asset] = paths[asset]?.map(pair => rates[pair]).reduce((acc, val) => acc.times(val)) ?? 0
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

export const rateService = new RateService()
