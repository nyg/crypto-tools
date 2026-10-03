import Big from 'big.js'
import type { SupertrendTrend } from '../../../types/api'
import type { SpotCandle } from '../../../types/portfolio'

export const ATR_LENGTH = 10
export const FACTOR = 3

export interface Supertrend {
   flipPrice: Big
   trend: SupertrendTrend
}

const TWO = Big(2)

const largest = (values: Big[]) => values.reduce((highest, value) => value.gt(highest) ? value : highest)

function trueRanges(candles: SpotCandle[]): Big[] {
   return candles.map(({ high, low }, index) => {
      const range = Big(high).minus(low)
      const previous = candles[index - 1]
      if (!previous) return range
      return largest([range, Big(high).minus(previous.close).abs(), Big(low).minus(previous.close).abs()])
   })
}

// Follows TradingView's ta.supertrend bar for bar: the bands count as 0 before the first
// ATR, the first bar with one is a downtrend, and the ATR is Wilder's, seeded with an SMA.
export function supertrend(candles: SpotCandle[], atrLength = ATR_LENGTH, factor = FACTOR): Supertrend | null {

   if (candles.length <= atrLength) return null

   const ranges = trueRanges(candles)
   const first = atrLength - 1

   let atr = ranges.slice(0, atrLength).reduce((sum, range) => sum.plus(range), Big(0)).div(atrLength)
   let upper = Big(0)
   let lower = Big(0)
   let line = upper
   let trend: SupertrendTrend = 'down'

   for (let index = first; index < candles.length; index++) {

      const { high, low, close } = candles[index]!
      if (index > first) atr = atr.times(atrLength - 1).plus(ranges[index]!).div(atrLength)

      const middle = Big(high).plus(low).div(TWO)
      const basicUpper = middle.plus(atr.times(factor))
      const basicLower = middle.minus(atr.times(factor))
      const previousClose = candles[index - 1]?.close

      const wasUpper = line.eq(upper)
      const brokeUpper = previousClose !== undefined && Big(previousClose).gt(upper)
      const brokeLower = previousClose !== undefined && Big(previousClose).lt(lower)
      upper = basicUpper.lt(upper) || brokeUpper ? basicUpper : upper
      lower = basicLower.gt(lower) || brokeLower ? basicLower : lower

      if (index === first) trend = 'down'
      else if (wasUpper) trend = Big(close).gt(upper) ? 'up' : 'down'
      else trend = Big(close).lt(lower) ? 'down' : 'up'

      line = trend === 'up' ? lower : upper
   }

   return { flipPrice: line, trend }
}
