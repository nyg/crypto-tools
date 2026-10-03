import Big from 'big.js'
import type { BybitDeposit, BybitInternalDeposit, BybitWithdrawal } from '../../../types/bybit-api'
import type { FundingRecord, FundingStatus } from '../../../types/funding'

const OFF_CHAIN = 1

const depositStatuses: Record<number, FundingStatus> = {
   3: 'completed', 4: 'failed', 10012: 'completed', 70011: 'failed', 70012: 'completed'
}

const internalDepositStatuses: Record<number, FundingStatus> = { 2: 'completed', 3: 'failed' }

const failedWithdrawals = [
   'CancelByUser', 'Reject', 'Fail',
   'HighValueReviewRejected', 'HighValueReviewRejectedRfunding', 'HighValueReviewRejectedRefunded'
]

const decimal = (value: string | undefined): string => Big(value || 0).toFixed()

// Bybit writes most times in milliseconds and the internal deposit's in seconds.
const millis = (value: string): number => {
   const time = Number(value)
   return time < 1e12 ? time * 1000 : time
}

// A deposit still on its way has no successAt yet, so it takes the time it was read
// at until a later sync finds it settled.
export function depositRecord(
   { id, txID, txIndex, coin, chain, amount, depositFee, status, successAt }: BybitDeposit, readAt: number
): FundingRecord {
   return {
      id: id || `${txID}:${txIndex ?? ''}`,
      kind: 'deposit',
      asset: coin,
      amount: decimal(amount),
      fee: decimal(depositFee),
      method: chain,
      status: depositStatuses[status] ?? 'pending',
      time: millis(successAt) || readAt
   }
}

export function internalDepositRecord({ id, coin, amount, status, createdTime }: BybitInternalDeposit): FundingRecord {
   return {
      id,
      kind: 'deposit',
      asset: coin,
      amount: decimal(amount),
      fee: '0',
      method: 'Internal',
      status: internalDepositStatuses[status] ?? 'pending',
      time: millis(createdTime)
   }
}

export function withdrawalRecord(
   { withdrawId, withdrawType, coin, chain, amount, withdrawFee, status, createTime }: BybitWithdrawal
): FundingRecord {
   return {
      id: withdrawId,
      kind: 'withdrawal',
      asset: coin,
      amount: decimal(amount),
      fee: decimal(withdrawFee),
      method: withdrawType === OFF_CHAIN ? 'Internal' : chain ?? '',
      status: status === 'success' ? 'completed' : failedWithdrawals.includes(status) ? 'failed' : 'pending',
      time: millis(createTime)
   }
}
