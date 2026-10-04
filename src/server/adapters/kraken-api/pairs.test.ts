import { describe, expect, test } from 'bun:test'
import { buildPairIndex, resolvePair, usdPairsFor } from './pairs'
import type { KrakenAssetPairs } from '../../../types/kraken-api'

const pair = (altname: string, base: string, quote: string, status = 'online') =>
   ({ altname, base, quote, status, lot_decimals: 8, cost_decimals: 5 })

const assetPairs: KrakenAssetPairs = {
   'XXBTZUSD.d': pair('XBTUSD.d', 'XXBT', 'ZUSD'),
   XXBTZUSD: pair('XBTUSD', 'XXBT', 'ZUSD'),
   ETHUSD1: pair('ETHUSD1', 'XETH', 'USD1'),
   XETHZUSD: pair('ETHUSD', 'XETH', 'ZUSD'),
   ZUSDZCAD: pair('USDCAD', 'ZUSD', 'ZCAD'),
   DOTUSD: pair('DOTUSD', 'DOT', 'ZUSD', 'delisted'),
   DOTEUR: pair('DOTEUR', 'DOT', 'ZEUR')
}

describe('usdPairsFor', () => {

   test('finds the USD pair of each asset asked for, in either direction', () => {

      const pairs = usdPairsFor(assetPairs, new Set(['BTC', 'ETH', 'CAD', 'DOT', 'SOL']))

      expect(Object.fromEntries(pairs)).toEqual({
         BTC: { altname: 'XBTUSD', inverse: false },
         ETH: { altname: 'ETHUSD', inverse: false },
         CAD: { altname: 'USDCAD', inverse: true }
      })
   })
})

describe('resolvePair', () => {

   const pairIndex = buildPairIndex(assetPairs)

   test('reads a listed pair from the index, whichever name the export wrote', () => {

      const btcUsd = { baseAsset: 'BTC', quoteAsset: 'USD', pairKey: 'BTC/USD' }

      expect(resolvePair('XXBTZUSD', pairIndex)).toEqual(btcUsd)
      expect(resolvePair('xbtusd', pairIndex)).toEqual(btcUsd)
   })

   test.each([
      ['BTC/LTC', 'BTC', 'LTC'],
      ['XBTLTC', 'BTC', 'LTC'],
      ['XXBTXLTC', 'BTC', 'LTC'],
      ['BTC/NMC', 'BTC', 'NMC'],
      ['XXBTXNMC', 'BTC', 'NMC'],
      ['MATIC/POL', 'MATIC', 'POL']
   ])('splits the delisted pair %s into %s and %s', (pair, baseAsset, quoteAsset) => {

      expect(resolvePair(pair, pairIndex))
         .toEqual({ baseAsset, quoteAsset, pairKey: `${baseAsset}/${quoteAsset}` })
   })

   test('tries the longest quote first', () => {
      expect(resolvePair('LTCUSDT', pairIndex)).toEqual({ baseAsset: 'LTC', quoteAsset: 'USDT', pairKey: 'LTC/USDT' })
   })

   test('keeps the raw pair when no known quote ends it', () => {
      expect(resolvePair('FOOBAR', pairIndex)).toEqual({ baseAsset: '', quoteAsset: '', pairKey: 'FOOBAR' })
   })
})
