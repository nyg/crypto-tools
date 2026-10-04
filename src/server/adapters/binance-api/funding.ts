import Big from 'big.js'
import type { BinanceDeposit, BinanceFiatOrder, BinanceWithdrawal } from '../../../types/binance-api'
import type { FundingKind, FundingRecord, FundingStatus } from '../../../types/funding'

const INTERNAL_TRANSFER = 1

const depositStatuses: Record<number, FundingStatus> = {
   0: 'pending', 1: 'completed', 2: 'failed', 6: 'completed', 7: 'failed', 8: 'pending'
}

const withdrawalStatuses: Record<number, FundingStatus> = {
   0: 'pending', 1: 'failed', 2: 'pending', 3: 'failed', 4: 'pending', 5: 'failed', 6: 'completed'
}

const fiatStatuses: Record<string, FundingStatus> = {
   processing: 'pending', successful: 'completed', finished: 'completed'
}

const decimal = (value: string | undefined): string => Big(value || 0).toFixed()

const methodOf = (network: string | undefined, transferType: number | undefined): string =>
   transferType === INTERNAL_TRANSFER ? 'Internal' : network ?? ''

export function depositRecord({ id, txId, coin, network, amount, status, insertTime, transferType }: BinanceDeposit): FundingRecord {
   return {
      id: id ?? txId ?? `${coin}-${insertTime}`,
      kind: 'deposit',
      asset: coin,
      amount: decimal(amount),
      fee: '0',
      method: methodOf(network, transferType),
      status: depositStatuses[status] ?? 'pending',
      time: insertTime
   }
}

export function withdrawalRecord({ id, coin, network, amount, transactionFee, status, applyTime, transferType }: BinanceWithdrawal): FundingRecord {
   return {
      id,
      kind: 'withdrawal',
      asset: coin,
      amount: decimal(amount),
      fee: decimal(transactionFee),
      method: methodOf(network, transferType),
      status: withdrawalStatuses[status] ?? 'pending',
      // Binance writes this one as '2019-10-12 11:12:02', in UTC.
      time: Date.parse(`${applyTime.replace(' ', 'T')}Z`)
   }
}

// indicatedAmount is what the user sent or asked for, and amount what is left of it
// after the fee: a deposit counts the first, a withdrawal the second.
export function fiatRecord(
   { orderNo, fiatCurrency, indicatedAmount, amount, totalFee, method, status, createTime }: BinanceFiatOrder, kind: FundingKind
): FundingRecord {
   return {
      id: orderNo,
      kind,
      asset: fiatCurrency,
      amount: decimal(kind === 'deposit' ? indicatedAmount : amount),
      fee: decimal(totalFee),
      method: method ?? '',
      status: fiatStatuses[status.toLowerCase()] ?? 'failed',
      time: createTime
   }
}
