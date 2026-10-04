import Big from 'big.js'
import type { FundingMovement } from '../../../types/api'
import type { FundingBalanceRow, FundingLedgerRow } from '../../../types/db'

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
         pending: false,
         balance: null
      }))
}

// The balance is every entry of the asset up to the second of the movement, in any
// wallet: Kraken's times have no finer grain, so entries sharing one have no order.
export function withBalances(movements: FundingMovement[], entries: FundingBalanceRow[]): FundingMovement[] {

   const balances = new Map<string, string>()

   for (const asset of new Set(movements.map(movement => movement.asset))) {

      const ledger = entries.filter(entry => entry.asset === asset).toSorted((a, b) => a.time - b.time)
      const held = movements.filter(movement => movement.asset === asset).toSorted((a, b) => a.time - b.time)
      let balance = Big(0)
      let next = 0

      for (const movement of held) {
         for (; next < ledger.length && ledger[next]!.time <= movement.time; next++) {
            balance = balance.plus(ledger[next]!.amount || 0).minus(ledger[next]!.fee || 0)
         }
         balances.set(movement.id, balance.toFixed())
      }
   }

   return movements.map(movement => ({ ...movement, balance: balances.get(movement.id) ?? null }))
}
