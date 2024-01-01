import { findPath } from 'modern-dijkstra'


const referenceAsset = 'USDT'

export default function RateFinder(assets) {

   let paths

   this.buildPairs = function (tradingPairs) {

      assets = assets.filter(asset => asset !== referenceAsset)
      tradingPairs = Object.keys(tradingPairs).map(pairId => tradingPairs[pairId])

      const quoteAssetsFrequency = tradingPairs
         .map(pair => pair.quote.name)
         .reduce((quoteAssets, asset) => {
            quoteAssets[asset] ??= 0
            quoteAssets[asset] += 1
            return quoteAssets
         }, {})

      quoteAssetsFrequency[referenceAsset] *= 10

      const graph = tradingPairs
         .reduce((graph, pair) => {
            graph[pair.base.name] ??= {}
            graph[pair.base.name][pair.quote.name] = tradingPairWeight(pair, quoteAssetsFrequency)
            return graph
         }, {})

      paths = assets
         .map(asset => {
            try {
               return findPath(graph, asset, referenceAsset)
            }
            catch (error) {
               console.warn(`Could not find a path for ${asset}`)
               return []
            }
         })
         .reduce((paths, path) => {
            paths[path[0]] ??= tradingPairsFrom(path)
            return paths
         }, {})

      return [...new Set(Object.values(paths).flatMap(x => x))]
   }

   this.buildRates = function (rates) {
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
      return 1 / ((quoteAssetsFrequency[pair.base.name] ?? 0) + (quoteAssetsFrequency[pair.quote.name] ?? 0))
   }
}
