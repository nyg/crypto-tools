import { describe, expect, test } from 'bun:test'
import { asDaysAgo } from './format'

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
