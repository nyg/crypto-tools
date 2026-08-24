import Big from 'big.js'
import type { QuoteTotals } from '../../types/api'

// A rate lookup for one asset at one moment. The time argument is accepted so a caller
// can price historically; the rate maps in use today ignore it.
export type RateAt = (asset: string, time?: number) => Big | null

export const ratesAt = (rates: Record<string, number | string> | undefined): RateAt => (asset) => {
   const rate = rates?.[asset]
   if (rate === undefined || rate === null) return null
   const value = Big(rate)
   return value.eq(0) ? null : value
}

export function convertQuotes(
   quotes: QuoteTotals[], targetQuote: string, rateAt: RateAt, time?: number
) {

   let cost = Big(0)
   let fee = Big(0)
   let netCost = Big(0)
   let volume = Big(0)
   let converted = false

   const missing: string[] = []

   for (const quote of quotes) {

      const factor = conversionFactor(quote.quoteAsset, targetQuote, rateAt, time)

      if (factor === null) {
         missing.push(quote.quoteAsset)
         continue
      }

      if (quote.quoteAsset !== targetQuote) converted = true

      cost = cost.plus(Big(quote.cost).times(factor))
      fee = fee.plus(Big(quote.fee).times(factor))
      netCost = netCost.plus(Big(quote.netCost).times(factor))
      volume = volume.plus(quote.volume)
   }

   return {
      cost,
      fee,
      netCost,
      volume,
      price: volume.eq(0) ? null : cost.div(volume),
      converted,
      missing
   }
}

function conversionFactor(
   quoteAsset: string, targetQuote: string, rateAt: RateAt, time?: number
): Big | null {

   if (quoteAsset === targetQuote) return Big(1)

   const from = rateAt(quoteAsset, time)
   const to = rateAt(targetQuote, time)

   return from && to ? from.div(to) : null
}
