import Big from 'big.js'
import type { SupertrendTrend } from '../../../types/api'
import type { CandleInterval, SpotCandle } from '../../../types/portfolio'

export const ATR_LENGTH = 10
export const FACTOR = 3

const DAY_MS = 86400000
const INTERVAL_MS: Record<CandleInterval, number> = { '1d': DAY_MS, '1w': 7 * DAY_MS }

export interface Supertrend {
   flipPrice: Big
   trend: SupertrendTrend
}

export interface SupertrendOptions {
   interval?: CandleInterval
   now?: number
   atrLength?: number
   factor?: number
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
// The one difference is the candle still forming at `now`: it moves the bands, but only a
// close flips the trend, where a chart flips it for as long as the price is past the band.
export function supertrend(
   candles: SpotCandle[],
   { interval = '1d', now = Infinity, atrLength = ATR_LENGTH, factor = FACTOR }: SupertrendOptions = {}
): Supertrend | null {

   if (candles.length <= atrLength) return null

   const ranges = trueRanges(candles)
   const first = atrLength - 1

   let atr = ranges.slice(0, atrLength).reduce((sum, range) => sum.plus(range), Big(0)).div(atrLength)
   let upper = Big(0)
   let lower = Big(0)
   let line = upper
   let trend: SupertrendTrend = 'down'

   for (let index = first; index < candles.length; index++) {

      const { time, high, low, close } = candles[index]!
      const forming = time + INTERVAL_MS[interval] > now
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
      else if (forming) trend = wasUpper ? 'down' : 'up'
      else if (wasUpper) trend = Big(close).gt(upper) ? 'up' : 'down'
      else trend = Big(close).lt(lower) ? 'down' : 'up'

      line = trend === 'up' ? lower : upper
   }

   return { flipPrice: line, trend }
}
