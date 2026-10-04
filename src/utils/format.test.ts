import { describe, expect, test } from 'bun:test'
import { asDaysAgo, asExactDecimal, decimalPadding, fractionDigits } from './format'

describe('asDaysAgo', () => {

   const now = new Date(2026, 8, 23, 8, 0)

   test('counts calendar days rather than elapsed hours', () => {
      expect(asDaysAgo(new Date(2026, 8, 23, 0, 5), now)).toBe('today')
      expect(asDaysAgo(new Date(2026, 8, 22, 23, 0), now)).toBe('yesterday')
      expect(asDaysAgo(new Date(2026, 8, 20, 9, 0), now)).toBe('3 days ago')
   })

   test('keeps whole days across a daylight saving change', () => {
      expect(asDaysAgo(new Date(2026, 9, 20, 12, 0), new Date(2026, 9, 27, 12, 0))).toBe('7 days ago')
      expect(asDaysAgo(new Date(2026, 2, 26, 12, 0), new Date(2026, 3, 2, 12, 0))).toBe('7 days ago')
   })

   test('treats a time later today as today', () => {
      expect(asDaysAgo(new Date(2026, 8, 23, 20, 0), now)).toBe('today')
   })
})

describe('asExactDecimal', () => {

   test('groups the whole part and keeps every decimal Kraken wrote', () => {
      expect(asExactDecimal('1234567.0012300000')).toBe('1,234,567.0012300000')
      expect(asExactDecimal('-25000.50')).toBe('-25,000.50')
      expect(asExactDecimal('0.00000001')).toBe('0.00000001')
      expect(asExactDecimal('1500')).toBe('1,500')
   })

   test('keeps digits beyond what a double can hold', () => {
      expect(asExactDecimal('98765432109876543.21')).toBe('98,765,432,109,876,543.21')
   })

   test('returns anything that is not a plain decimal unchanged', () => {
      expect(asExactDecimal('')).toBe('')
      expect(asExactDecimal('1e-8')).toBe('1e-8')
   })
})

describe('decimalPadding', () => {

   test('counts the digits after the decimal point', () => {
      expect(['0.000015', '1.5', '1500', '-0.25'].map(fractionDigits)).toEqual([6, 1, 0, 2])
   })

   test('fills a decimal up to the longest fraction of its column', () => {
      expect(decimalPadding('0.05', 6)).toBe('0000')
      expect(decimalPadding('0.000015', 6)).toBe('')
   })

   test('stands in for the separator too when the value has no fraction', () => {
      expect(decimalPadding('1', 5)).toHaveLength(6)
      expect(decimalPadding('1', 5).slice(1)).toBe('00000')
      expect(decimalPadding('1', 0)).toBe('')
   })
})
