import { describe, expect, test } from 'bun:test'
import { flipDistance, flipExtension } from './format'

describe('flipDistance', () => {

   test('is how far the price has to fall in an uptrend, as a negative percentage', () => {
      expect(flipDistance('90', '100')).toBe('-10.0000')
   })

   test('is how far the price has to rise in a downtrend, as a positive percentage', () => {
      expect(flipDistance('0.0195', '0.013')).toBe('50.0000')
   })

   test('is unknown for a coin without a price', () => {
      expect(flipDistance('90', null)).toBeNull()
      expect(flipDistance('90', '0')).toBeNull()
   })
})

describe('flipExtension', () => {

   test('is how far the price has run above the flip price in an uptrend', () => {
      expect(flipExtension('80', '100')).toBe('25.0000')
   })

   test('is how far the price has run below the flip price in a downtrend', () => {
      expect(flipExtension('0.02', '0.015')).toBe('-25.0000')
   })

   test('is unknown for a coin without a price', () => {
      expect(flipExtension('80', null)).toBeNull()
   })
})
