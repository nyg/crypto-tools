import { describe, expect, test } from 'bun:test'
import {
   CONVERTIBLE_QUOTES, DAY_MS, FIAT_QUOTES, MAX_CARRIED_DAYS, convertOrders, isConvertibleQuote, rateLookup
} from './quote-conversion'
import { ECB_CURRENCIES } from '../services/usd-rate-backfill'
import type { Order } from '../../types/api'
import type { UsdRateRow } from '../../types/db'

const monday = Date.UTC(2024, 2, 4)
const tuesday = monday + DAY_MS

const rate = (asset: string, day: number, value: number): UsdRateRow => ({ asset, day, rate: value, source: 'ecb' })

const order = (quoteAsset: string, time: number, changes: Partial<Order> = {}): Order => ({
   orderId: 'O', orderKey: `${quoteAsset}-${time}`, time, tradeCount: 1,
   pair: `BTC/${quoteAsset}`, rawPair: `XBT${quoteAsset}`, baseAsset: 'BTC', quoteAsset,
   direction: 'buy', ordertype: 'limit', volume: '1', cost: '100', fee: '1', netCost: '101',
   price: '100', margin: false, misc: '', ...changes
})

describe('convertible quotes', () => {

   test('are the fiat currencies and the stablecoins, never another coin', () => {

      expect(isConvertibleQuote('CHF')).toBe(true)
      expect(isConvertibleQuote('USDT')).toBe(true)
      expect(isConvertibleQuote('BTC')).toBe(false)
      expect(isConvertibleQuote('')).toBe(false)
      expect(isConvertibleQuote(undefined)).toBe(false)
      expect(CONVERTIBLE_QUOTES).not.toContain('ETH')
   })

   test('have an ECB rate for every fiat currency but USD', () => {

      const withoutRate = FIAT_QUOTES.filter(asset => asset !== 'USD' && !ECB_CURRENCIES.has(asset))

      expect(withoutRate).toEqual([])
   })
})

describe('rateLookup', () => {

   test('reads the rate of the UTC day the time falls on', () => {

      const rateOn = rateLookup([rate('EUR', monday, 1.1), rate('EUR', tuesday, 1.2)])

      expect(rateOn('EUR', monday + 13 * 3600000)?.toString()).toBe('1.1')
      expect(rateOn('EUR', tuesday)?.toString()).toBe('1.2')
   })

   test('carries the last rate forward for seven days and no further', () => {

      const rateOn = rateLookup([rate('EUR', monday, 1.1)])

      expect(rateOn('EUR', monday + MAX_CARRIED_DAYS * DAY_MS)?.toString()).toBe('1.1')
      expect(rateOn('EUR', monday + (MAX_CARRIED_DAYS + 1) * DAY_MS)).toBeNull()
   })

   test('never reads the rate of a later day', () => {

      const rateOn = rateLookup([rate('EUR', tuesday, 1.2)])

      expect(rateOn('EUR', monday)).toBeNull()
   })

   test('counts USD as 1 without a row', () => {

      expect(rateLookup([])('USD', monday)?.toString()).toBe('1')
   })

   test('has no rate for an asset without rows', () => {

      expect(rateLookup([rate('EUR', monday, 1.1)])('CHF', monday)).toBeNull()
   })
})

describe('convertOrders', () => {

   test('keeps orders in the target quote exact and reads no rate', () => {

      const totals = convertOrders([
         order('EUR', monday, { volume: '0.1', cost: '0.1', fee: '0.01', netCost: '0.11' }),
         order('EUR', tuesday, { volume: '0.2', cost: '0.2', fee: '0.02', netCost: '0.22' })
      ], 'EUR', rateLookup([]))

      expect(totals).toEqual({
         volume: '0.3', cost: '0.3', fee: '0.03', netCost: '0.33', price: '1', converted: false, unconverted: []
      })
   })

   test('converts each order at the rate of its own day', () => {

      const rateOn = rateLookup([rate('EUR', monday, 1.1), rate('EUR', tuesday, 1.2)])

      const totals = convertOrders([order('EUR', monday), order('EUR', tuesday)], 'USD', rateOn)

      expect(totals).toEqual({
         volume: '2', cost: '230', fee: '2.3', netCost: '232.3', price: '115', converted: true, unconverted: []
      })
   })

   test('divides by the rate of the target quote on that day', () => {

      const rateOn = rateLookup([rate('EUR', monday, 1.1), rate('CHF', monday, 1.25)])

      const totals = convertOrders([order('EUR', monday), order('USD', monday)], 'CHF', rateOn)

      expect(totals.cost).toBe('168')
      expect(totals.price).toBe('84')
      expect(totals.converted).toBe(true)
   })

   test('leaves out an order with no rate and reports its volume', () => {

      const rateOn = rateLookup([rate('EUR', monday, 1.1)])

      const totals = convertOrders([
         order('EUR', monday),
         order('GBP', monday, { volume: '0.5' }),
         order('GBP', tuesday, { volume: '0.25' })
      ], 'USD', rateOn)

      expect(totals.volume).toBe('1')
      expect(totals.cost).toBe('110')
      expect(totals.unconverted).toEqual([{ quoteAsset: 'GBP', volume: '0.75' }])
   })

   test('has no price when nothing could be converted', () => {

      const totals = convertOrders([order('EUR', monday)], 'USD', rateLookup([]))

      expect(totals.volume).toBe('0')
      expect(totals.price).toBeNull()
      expect(totals.converted).toBe(false)
   })
})
