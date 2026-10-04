import Big from 'big.js'
import type { SupertrendLevel } from '../../types/api'

export function supertrendStop(
   level: SupertrendLevel | null | undefined, price: string | null, tickStep: string | undefined
): string | null {

   if (!level || level.trend !== 'up') return null

   const tick = Big(tickStep || 0)
   const flipPrice = Big(level.flipPrice)
   const stop = tick.gt(0) ? flipPrice.div(tick).round(0, Big.roundDown).times(tick) : flipPrice

   if (stop.lte(0) || (price !== null && stop.gte(price))) return null
   return stop.toFixed()
}
