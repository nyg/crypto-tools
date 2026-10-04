import { expect, test } from 'bun:test'
import { normalizeAsset } from './assets'

test.each([
   ['XXBT', 'BTC'],
   ['XBT.F', 'BTC'],
   ['ZUSD', 'USD'],
   ['DOT28.S', 'DOT'],
   ['KSM07.S', 'KSM'],
   ['ETH2', 'ETH'],
   ['ETH2.S', 'ETH'],
   ['AI16Z', 'AI16Z'],
   ['USD1', 'USD1'],
   ['POL.S', 'POL'],
   ['MATIC', 'POL'],
   ['MATIC04.S', 'POL'],
   ['LUNA', 'LUNA'],
   ['LUNA.S', 'LUNA'],
   ['LUNA2', 'LUNA2'],
   ['LUNA2.F', 'LUNA2'],
   ['LUNA2.S', 'LUNA2'],
   ['USDT.M', 'USDT'],
   ['USDT0', 'USDT0'],
   ['USDT0.TEMPO', 'USDT0'],
   ['SN8.F', 'SN8'],
   ['SN44.F', 'SN44']
])('%s is added up under %s', (asset, normalized) => {
   expect(normalizeAsset(asset)).toBe(normalized)
})
