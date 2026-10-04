import { expect, test } from 'bun:test'
import { normalizeAsset, tickerOf } from './assets'

test.each([
   ['XXBT', 'BTC', 'BTC'],
   ['XBT.F', 'BTC', 'BTC'],
   ['ZUSD', 'USD', 'USD'],
   ['DOT28.S', 'DOT', 'DOT'],
   ['ETH2.S', 'ETH', 'ETH'],
   ['AI16Z', 'AI16Z', 'AI16Z'],
   ['USD1', 'USD1', 'USD1'],
   ['POL.S', 'POL', 'POL'],
   ['MATIC', 'MATIC', 'POL'],
   ['MATIC.S', 'MATIC', 'POL']
])('%s is written as %s and added up under %s', (asset, ticker, normalized) => {
   expect(tickerOf(asset)).toBe(ticker)
   expect(normalizeAsset(asset)).toBe(normalized)
})
