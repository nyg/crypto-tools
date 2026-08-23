import { normalizeAsset } from './assets'
import type { KrakenAssetPairs } from '../../../types/kraken-api'
import type { PairAssets, PairIndex, ResolvedPair } from '../../../types/kraken'

// The trades export writes the pair the way it was spelled at the time of the trade,
// which is not consistently any one of the three names AssetPairs returns: old rows
// carry the result key (XXBTZUSD), newer ones the altname (XBTUSD), and a few the
// wsname (XBT/USD). Indexing all three means a lookup succeeds whichever it is.
// The wsname is the odd one out in carrying a separator, so it is dropped on both
// sides of the lookup rather than only when the index is built — otherwise a trade
// written as XBT/USD would miss the index and fall through to the suffix split,
// which would read the slash as part of the base asset.
const indexKey = (name: string) => name.toUpperCase().replace('/', '')

export function buildPairIndex(assetPairs: KrakenAssetPairs | undefined): PairIndex {

   const index: PairIndex = new Map()

   for (const [key, pair] of Object.entries(assetPairs ?? {})) {

      const assets = {
         baseAsset: normalizeAsset(pair.base),
         quoteAsset: normalizeAsset(pair.quote)
      }

      for (const name of [key, pair.altname, pair.wsname]) {
         if (name) index.set(indexKey(name), assets)
      }
   }

   return index
}

// Longest first, so USDT is tried before USD and ZUSD before USD — otherwise
// XBTUSDT would split as XBTUSD + T.
const quoteAssets = [
   'USDT', 'USDC', 'ZUSD', 'ZEUR', 'ZGBP', 'ZCAD', 'ZJPY', 'ZAUD', 'ZCHF',
   'XXBT', 'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'XBT', 'BTC', 'ETH', 'DAI'
].toSorted((a, b) => b.length - a.length)

// Pairs that have been delisted are gone from AssetPairs entirely, so a trade in one
// would otherwise lose its assets. Splitting on a known quote ticker recovers most of
// them; anything left keeps the raw pair, which is still recognisable on screen.
function splitOnQuote(pair: string): PairAssets | null {

   for (const quote of quoteAssets) {
      if (pair.length > quote.length && pair.endsWith(quote)) {
         return {
            baseAsset: normalizeAsset(pair.slice(0, -quote.length)),
            quoteAsset: normalizeAsset(quote)
         }
      }
   }

   return null
}

export function resolvePair(pair: string | undefined, index: PairIndex | undefined): ResolvedPair {

   const raw = (pair ?? '').trim()
   if (raw === '') return { baseAsset: '', quoteAsset: '', pairKey: '' }

   const name = indexKey(raw)
   const assets = index?.get(name) ?? splitOnQuote(name)
   if (!assets) return { baseAsset: '', quoteAsset: '', pairKey: name }

   return { ...assets, pairKey: `${assets.baseAsset}/${assets.quoteAsset}` }
}
