import { describe, expect, test } from 'bun:test'
import { supertrendStop } from './supertrend-stops'

describe('a stop price taken from the Supertrend', () => {

   test('is the flip price of an uptrend, floored to the tick of the market', () => {
      expect(supertrendStop({ flipPrice: '60395.12345678', trend: 'up' }, '64250', '0.1')).toBe('60395.1')
      expect(supertrendStop({ flipPrice: '0.12345678', trend: 'up' }, '0.14', '0.0001')).toBe('0.1234')
   })

   test('is the flip price as it is when the tick is unknown', () => {
      expect(supertrendStop({ flipPrice: '60395.12345678', trend: 'up' }, '64250', undefined)).toBe('60395.12345678')
   })

   test('is taken without a current price to check it against', () => {
      expect(supertrendStop({ flipPrice: '60395', trend: 'up' }, null, '0.1')).toBe('60395')
   })

   test('is none in a downtrend, where the flip price is above the price', () => {
      expect(supertrendStop({ flipPrice: '70000', trend: 'down' }, '64250', '0.1')).toBeNull()
   })

   test('is none when the price already fell through the flip price', () => {
      expect(supertrendStop({ flipPrice: '65000', trend: 'up' }, '64250', '0.1')).toBeNull()
      expect(supertrendStop({ flipPrice: '64250', trend: 'up' }, '64250', '0.1')).toBeNull()
   })

   test('is none without a level', () => {
      expect(supertrendStop(null, '64250', '0.1')).toBeNull()
      expect(supertrendStop(undefined, '64250', '0.1')).toBeNull()
   })
})
