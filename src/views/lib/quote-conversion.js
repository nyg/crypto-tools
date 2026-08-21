import Big from 'big.js'

export const ratesAt = (rates) => (asset) => {
   const rate = rates?.[asset]
   if (rate === undefined || rate === null) return null
   const value = Big(rate)
   return value.eq(0) ? null : value
}

export function convertQuotes(quotes, targetQuote, rateAt, time) {

   let cost = Big(0)
   let fee = Big(0)
   let netCost = Big(0)
   let volume = Big(0)
   let converted = false

   const missing = []

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

function conversionFactor(quoteAsset, targetQuote, rateAt, time) {

   if (quoteAsset === targetQuote) return Big(1)

   const from = rateAt(quoteAsset, time)
   const to = rateAt(targetQuote, time)

   return from && to ? from.div(to) : null
}
