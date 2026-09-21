import { describe, expect, test } from 'bun:test'
import { numericKey, sortRows } from './sort'
import type { SortKeys } from './sort'

interface Row {
   asset: string
   value: string | null
}

const rows: Row[] = [
   { asset: 'ETH', value: '30' },
   { asset: 'BTC', value: null },
   { asset: 'SOL', value: '120' },
   { asset: 'ADA', value: '30' }
]

const keys: SortKeys<Row> = {
   asset: row => row.asset,
   value: row => numericKey(row.value)
}

const assetsOf = (sorted: Row[]) => sorted.map(({ asset }) => asset)

describe('sortRows', () => {

   test('keeps the given order when no column is sorted', () => {
      expect(sortRows(rows, {}, keys)).toBe(rows)
   })

   test('keeps the given order for a column it has no key for', () => {
      expect(sortRows(rows, { column: 'price', direction: 'desc' }, keys)).toBe(rows)
   })

   test('sorts numbers descending and keeps ties in their given order', () => {
      expect(assetsOf(sortRows(rows, { column: 'value', direction: 'desc' }, keys))).toEqual(['SOL', 'ETH', 'ADA', 'BTC'])
   })

   test('sorts numbers ascending and still puts a missing value last', () => {
      expect(assetsOf(sortRows(rows, { column: 'value', direction: 'asc' }, keys))).toEqual(['ETH', 'ADA', 'SOL', 'BTC'])
   })

   test('sorts text in both directions', () => {
      expect(assetsOf(sortRows(rows, { column: 'asset', direction: 'asc' }, keys))).toEqual(['ADA', 'BTC', 'ETH', 'SOL'])
      expect(assetsOf(sortRows(rows, { column: 'asset', direction: 'desc' }, keys))).toEqual(['SOL', 'ETH', 'BTC', 'ADA'])
   })

   test('leaves the rows it was given untouched', () => {
      sortRows(rows, { column: 'asset', direction: 'asc' }, keys)
      expect(assetsOf(rows)).toEqual(['ETH', 'BTC', 'SOL', 'ADA'])
   })
})
