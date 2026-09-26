import { describe, expect, test } from 'bun:test'
import { usdPairsFor } from './pairs'
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
