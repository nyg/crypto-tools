import { expect, test } from 'bun:test'
import { assetLabel } from './asset-migrations'

test.each([
   ['POL', 'POL (ex. MATIC)'],
   ['AI16Z', 'AI16Z (now ELIZAOS)'],
   ['ELIZAOS', 'ELIZAOS'],
   ['BTC', 'BTC']
])('lists %s as %s', (asset, label) => {
   expect(assetLabel(asset)).toBe(label)
})
