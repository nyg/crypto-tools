import Big from 'big.js'
import type { ConvertedTotals, Order } from '../../types/api'
import type { UsdRateRow } from '../../types/db'

export const DAY_MS = 86400000

export const MAX_CARRIED_DAYS = 7

export const FIAT_QUOTES = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'JPY', 'AUD']

export const STABLECOIN_QUOTES = ['USDT', 'USDC', 'DAI']

export const CONVERTIBLE_QUOTES = [...FIAT_QUOTES, ...STABLECOIN_QUOTES]

export const isConvertibleQuote = (asset: string | undefined) => CONVERTIBLE_QUOTES.includes(asset ?? '')

export type RateOn = (asset: string, time: number) => Big | null

export const dayOf = (time: number) => time - (time % DAY_MS)

export function rateLookup(rows: UsdRateRow[]): RateOn {

   const byAsset = new Map<string, Map<number, number>>()

   for (const row of rows) {
      const days = byAsset.get(row.asset) ?? new Map<number, number>()
      days.set(row.day, row.rate)
      byAsset.set(row.asset, days)
   }

   return (asset, time) => {

      if (asset === 'USD') return Big(1)

      const days = byAsset.get(asset)
      if (!days) return null

      const day = dayOf(time)

      for (let carried = 0; carried <= MAX_CARRIED_DAYS; carried++) {
         const rate = days.get(day - carried * DAY_MS)
         if (rate) return Big(rate)
      }

      return null
   }
}

export function convertOrders(orders: Order[], targetQuote: string, rateOn: RateOn): ConvertedTotals {

   let volume = Big(0)
   let cost = Big(0)
   let fee = Big(0)
   let netCost = Big(0)
   let converted = false

   const unconverted = new Map<string, Big>()

   for (const order of orders) {

      const factor = conversionFactor(order, targetQuote, rateOn)

      if (factor === null) {
         unconverted.set(order.quoteAsset, (unconverted.get(order.quoteAsset) ?? Big(0)).plus(order.volume))
         continue
      }

      if (order.quoteAsset !== targetQuote) converted = true

      volume = volume.plus(order.volume)
      cost = cost.plus(factor.times(order.cost))
      fee = fee.plus(factor.times(order.fee))
      netCost = netCost.plus(factor.times(order.netCost))
   }

   return {
      volume: volume.toFixed(),
      cost: cost.toFixed(),
      fee: fee.toFixed(),
      netCost: netCost.toFixed(),
      price: volume.eq(0) ? null : cost.div(volume).toFixed(),
      converted,
      unconverted: [...unconverted].map(([quoteAsset, left]) => ({ quoteAsset, volume: left.toFixed() }))
   }
}

function conversionFactor(order: Order, targetQuote: string, rateOn: RateOn): Big | null {

   if (order.quoteAsset === targetQuote) return Big(1)

   const from = rateOn(order.quoteAsset, order.time)
   const to = rateOn(targetQuote, order.time)

   return from && to ? from.div(to) : null
}
