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
   ['MATIC.S', 'MATIC', 'POL'],
   ['MATIC04.S', 'MATIC', 'POL'],
   ['KSM07.S', 'KSM', 'KSM'],
   ['ETH2', 'ETH', 'ETH'],
   ['LUNA', 'LUNA', 'LUNA'],
   ['LUNA.S', 'LUNA', 'LUNA'],
   ['LUNA2', 'LUNA2', 'LUNA2'],
   ['LUNA2.F', 'LUNA2', 'LUNA2'],
   ['LUNA2.S', 'LUNA2', 'LUNA2'],
   ['USDT.M', 'USDT', 'USDT'],
   ['USDT0', 'USDT0', 'USDT0'],
   ['USDT0.TEMPO', 'USDT0', 'USDT0'],
   ['SN8.F', 'SN8', 'SN8'],
   ['SN44.F', 'SN44', 'SN44']
])('%s is written as %s and added up under %s', (asset, ticker, normalized) => {
   expect(tickerOf(asset)).toBe(ticker)
   expect(normalizeAsset(asset)).toBe(normalized)
})
