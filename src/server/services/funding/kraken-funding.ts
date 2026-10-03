import Big from 'big.js'
import type { FundingMovement } from '../../../types/api'
import type { FundingLedgerRow } from '../../../types/db'

interface Folded {
   row: FundingLedgerRow
   amount: Big
   fee: Big
}

// Kraken writes a withdrawal it later reverses as two rows sharing one reference, the
// second giving the amount and the fee back. Folded together they cancel out, and a
// withdrawal that never left the account is not listed.
export function foldLedgerFunding(rows: FundingLedgerRow[]): FundingMovement[] {

   const folded = new Map<string, Folded>()

   for (const row of rows) {
      const key = `${row.type}:${row.asset}:${row.refid || row.entryKey}`
      const sign = row.type === 'deposit' ? 1 : -1
      const current = folded.get(key) ?? { row, amount: Big(0), fee: Big(0) }

      folded.set(key, {
         row: current.row,
         amount: current.amount.plus(Big(row.amount || 0).times(sign)),
         fee: current.fee.plus(row.fee || 0)
      })
   }

   return [...folded.values()]
      .filter(({ amount }) => amount.gt(0))
      .map(({ row, amount, fee }) => ({
         id: row.entryKey,
         kind: row.type,
         asset: row.asset,
         amount: amount.toFixed(),
         fee: fee.toFixed(),
         method: '',
         time: row.time,
         pending: false
      }))
}
