import Big from 'big.js'
import { asAssetAmount, asDecimal, asShortPercentage, asSignedShortPercentage } from '../../../utils/format'
import type {
   RunKind, RunOrderStatus, RunStatus, SkipReason, StopSkipReason, StopStatus
} from '../../../types/portfolio'

const QUOTE_DECIMALS = 2
const POINT_DECIMALS = 1

export const asQuoteAmount = (value: string | null | undefined, asset: string) =>
   value === null || value === undefined ? '—' : `${asDecimal(Number(value), QUOTE_DECIMALS)} ${asset}`

export const showsAsZeroQuoteAmount = (value: string) => Big(value).round(QUOTE_DECIMALS).eq(0)

export const asSignedQuoteAmount = (value: string | null, asset: string) =>
   value === null ? '—'
      : showsAsZeroQuoteAmount(value) ? asQuoteAmount('0', asset)
         : `${Number(value) > 0 ? '+' : ''}${asQuoteAmount(value, asset)}`

export const profitColor = (value: string | null) =>
   value === null || showsAsZeroQuoteAmount(value) ? undefined
      : Number(value) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'

export const asWeight = (value: string | null | undefined) =>
   value === null || value === undefined ? '—' : asShortPercentage(Number(value) / 100)

export const asSignedPercent = (value: string) => asSignedShortPercentage(Number(value) / 100)

export const asPoints = (value: string) => asDecimal(Number(value), POINT_DECIMALS)

export const asDrift = (value: string | null | undefined) =>
   value === null || value === undefined ? '—'
      : `${Big(value).round(POINT_DECIMALS).gt(0) ? '+' : ''}${asPoints(value)} pt`

export const asQuantity = (value: string | null | undefined) =>
   value === null || value === undefined ? '—' : Number(value) === 0 ? '0' : asAssetAmount(Number(value))

export const skipReasons: Record<SkipReason, string> = {
   'within-band': 'within the band',
   'below-minimum': 'below the minimum order',
   'no-market': 'no market against the cash coin',
   'unpriced': 'no price right now',
   'no-free-balance': 'nothing free in the wallet to sell',
   'no-cash': 'not enough cash to buy with'
}

export const orderStatusLabels: Record<RunOrderStatus, string> = {
   pending: 'Waiting',
   placed: 'Placed',
   filled: 'Filled',
   partial: 'Partly filled',
   rejected: 'Rejected',
   failed: 'Failed',
   skipped: 'Skipped',
   unknown: 'Checking'
}

export const stopStatusLabels: Record<StopStatus, string> = {
   pending: 'Placing',
   placed: 'Armed',
   cancelled: 'Cancelled',
   filled: 'Sold',
   partial: 'Partly sold',
   failed: 'Failed',
   missing: 'Gone'
}

export const stopSkipReasons: Record<StopSkipReason, string> = {
   'no-market': 'no market against the cash coin',
   'too-small': 'the holding is below the minimum order',
   'above-price': 'the stop price is at or above the current price',
   'no-free-balance': 'nothing free in the wallet to sell'
}

export const runStatusLabels: Record<RunStatus, string> = {
   running: 'Running',
   done: 'Done',
   partial: 'Partly done',
   error: 'Failed',
   interrupted: 'Interrupted'
}

export const runKindLabels: Record<RunKind, string> = {
   rebalance: 'Rebalance',
   withdraw: 'Withdrawal',
   stop: 'Stop'
}
