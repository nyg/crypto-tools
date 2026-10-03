import type { BybitKline } from '../../../types/bybit-api'
import type { SpotCandle } from '../../../types/portfolio'

export const candlesFromKlines = (klines: BybitKline[]): SpotCandle[] =>
   klines.map(([time, , high, low, close]) => ({ time: Number(time), high, low, close })).toReversed()
