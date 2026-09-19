import Big from 'big.js'
import { asAssetAmount, asDecimal, asPercentage } from '../../../utils/format'
import type { RunOrderStatus, RunStatus, SkipReason } from '../../../types/portfolio'

const QUOTE_DECIMALS = 2

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
   value === null || value === undefined ? '—' : asPercentage(Number(value) / 100)

export const asDrift = (value: string | null | undefined) =>
   value === null || value === undefined ? '—' : `${Number(value) > 0 ? '+' : ''}${asDecimal(Number(value), 2)} pt`

export const asQuantity = (value: string | null | undefined) =>
   value === null || value === undefined ? '—' : Number(value) === 0 ? '0' : asAssetAmount(Number(value))

export const skipReasons: Record<SkipReason, string> = {
   'within-band': 'within the band',
   'below-minimum': 'below the minimum order',
   'no-market': 'no market against the cash coin',
   'unpriced': 'no price right now',
   'no-free-balance': 'nothing free in the wallet to sell',
   'no-cash': 'no cash left to buy with'
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

export const runStatusLabels: Record<RunStatus, string> = {
   running: 'Running',
   done: 'Done',
   partial: 'Partly done',
   error: 'Failed',
   interrupted: 'Interrupted'
}
