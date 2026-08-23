import { findPath } from 'modern-dijkstra'
import type Big from 'big.js'
import type { Graph } from 'modern-dijkstra'
import type { PairRates } from '../../types/binance'
import type { TradingPair, TradingPairs } from '../../types/market'

type AssetFrequency = Record<string, number>

const referenceAsset = 'USDT'

export default class RateFinder {

   #assets: string[]
   #paths: Record<string, string[]> = {}

   constructor(assets: string[]) {
      this.#assets = assets
   }

   buildPairs(tradingPairs: TradingPairs): string[] {

      this.#assets = this.#assets.filter(asset => asset !== referenceAsset)
      const pairs = Object.keys(tradingPairs).map(pairId => tradingPairs[pairId])

      const quoteAssetsFrequency = pairs
         .map(pair => pair.quote.name)
         .reduce<AssetFrequency>((quoteAssets, asset) => {
            quoteAssets[asset] ??= 0
            quoteAssets[asset] += 1
            return quoteAssets
         }, {})

      quoteAssetsFrequency[referenceAsset] *= 10

      const graph = pairs
         .reduce<Graph>((graph, pair) => {
            graph[pair.base.name] ??= {}
            graph[pair.base.name][pair.quote.name] = this.#tradingPairWeight(pair, quoteAssetsFrequency)
            return graph
         }, {})

      this.#paths = this.#assets
         .map(asset => {
            try {
               return findPath(graph, asset, referenceAsset)
            }
            catch {
               console.warn(`Could not find a path for ${asset}`)
               return []
            }
         })
         .reduce<Record<string, string[]>>((paths, path) => {
            paths[path[0]] ??= this.#tradingPairsFrom(path)
            return paths
         }, {})

      return [...new Set(Object.values(this.#paths).flatMap(x => x))]
   }

   buildRates(rates: PairRates): Record<string, Big | number> {
      return this.#assets.reduce<Record<string, Big | number>>((prices, asset) => {
         prices[asset] = this.#paths[asset]
            ?.map(pair => rates[pair])
            .reduce((acc, val) => acc.times(val)) ?? 0
         return prices
      }, { [referenceAsset]: 1 })
   }

   #tradingPairsFrom(path: string[]): string[] {
      return path.reduce<string[]>((pairs, quote, index) => {

         if (index != 0) {
            pairs.push(`${path[index - 1]}${quote}`)
         }

         return pairs
      }, [])
   }

   #tradingPairWeight(pair: TradingPair, quoteAssetsFrequency: AssetFrequency): number {
      return 1 / ((quoteAssetsFrequency[pair.base.name] ?? 0) + (quoteAssetsFrequency[pair.quote.name] ?? 0))
   }
}
