import { describe, expect, test } from 'bun:test'
import { foldLedgerFunding, withBalances } from './kraken-funding'
import type { FundingBalanceRow, FundingLedgerRow } from '../../../types/db'

const TIME = Date.UTC(2026, 7, 1, 10)

const row = (entryKey: string, changes: Partial<FundingLedgerRow> = {}): FundingLedgerRow => ({
   entryKey, refid: `R${entryKey}`, time: TIME, type: 'deposit', asset: 'EUR', amount: '1000.0000', fee: '0.0000', ...changes
})

describe('foldLedgerFunding', () => {

   test('lists a deposit and a withdrawal with a positive amount and the fee beside it', () => {
      expect(foldLedgerFunding([
         row('D1', { fee: '1.5000' }),
         row('W1', { type: 'withdrawal', asset: 'BTC', amount: '-0.25000000', fee: '0.00015000', time: TIME + 1 })
      ])).toEqual([
         { id: 'D1', kind: 'deposit', asset: 'EUR', amount: '1000', fee: '1.5', method: '', time: TIME, pending: false, balance: null },
         { id: 'W1', kind: 'withdrawal', asset: 'BTC', amount: '0.25', fee: '0.00015', method: '', time: TIME + 1, pending: false, balance: null }
      ])
   })

   test('leaves out a withdrawal Kraken reversed under the same reference', () => {
      expect(foldLedgerFunding([
         row('W1', { refid: 'REF', type: 'withdrawal', asset: 'ETH', amount: '-1.5', fee: '0.0035' }),
         row('W2', { refid: 'REF', type: 'withdrawal', asset: 'ETH', amount: '1.5', fee: '-0.0035', time: TIME + 60000 })
      ])).toEqual([])
   })

   test('keeps what is left of a withdrawal reversed in part, at the time it was first written', () => {
      expect(foldLedgerFunding([
         row('W1', { refid: 'REF', type: 'withdrawal', asset: 'ETH', amount: '-1.5', fee: '0.0035' }),
         row('W2', { refid: 'REF', type: 'withdrawal', asset: 'ETH', amount: '0.5', fee: '0', time: TIME + 60000 })
      ])).toMatchObject([{ id: 'W1', amount: '1', fee: '0.0035', time: TIME }])
   })

   test('keeps rows apart that carry no reference, and a deposit apart from a withdrawal sharing one', () => {
      expect(foldLedgerFunding([
         row('D1', { refid: '' }),
         row('D2', { refid: '' }),
         row('D3', { refid: 'REF' }),
         row('W3', { refid: 'REF', type: 'withdrawal', amount: '-1000.0000' })
      ]).map(({ id, kind }) => ({ id, kind }))).toEqual([
         { id: 'D1', kind: 'deposit' },
         { id: 'D2', kind: 'deposit' },
         { id: 'D3', kind: 'deposit' },
         { id: 'W3', kind: 'withdrawal' }
      ])
   })
})

describe('withBalances', () => {

   const SECOND = 1000

   const held = (asset: string, time: number, amount: string, fee = '0'): FundingBalanceRow => ({ asset, time, amount, fee })

   const movements = foldLedgerFunding([
      row('D1', { time: TIME }),
      row('W1', { type: 'withdrawal', amount: '-300.0000', fee: '1.0000', time: TIME + 2 * SECOND }),
      row('B1', { type: 'withdrawal', asset: 'BTC', amount: '-0.1', fee: '0.0001', time: TIME + 2 * SECOND })
   ])

   test('gives each movement what was held of its asset once it went through, fees taken off', () => {

      const balances = withBalances(movements, [
         held('EUR', TIME - SECOND, '50.0000'),
         held('EUR', TIME, '1000.0000'),
         held('EUR', TIME + SECOND, '-200.0000', '0.5000'),
         held('EUR', TIME + 2 * SECOND, '-300.0000', '1.0000'),
         held('EUR', TIME + 3 * SECOND, '5000.0000'),
         held('BTC', TIME + SECOND, '0.5'),
         held('BTC', TIME + 2 * SECOND, '-0.1', '0.0001')
      ])

      expect(balances.map(({ id, balance }) => ({ id, balance }))).toEqual([
         { id: 'D1', balance: { after: '1050', low: '0', high: '1050' } },
         { id: 'W1', balance: { after: '548.5', low: '548.5', high: '1050' } },
         { id: 'B1', balance: { after: '0.3999', low: '0', high: '0.5' } }
      ])
   })

   test('reports how low and how high trades took the balance since the movement before', () => {

      const balances = withBalances(movements, [
         held('EUR', TIME, '1000.0000'),
         held('EUR', TIME + SECOND, '4000.0000'),
         held('EUR', TIME + SECOND + 1, '-4900.0000'),
         held('EUR', TIME + 2 * SECOND, '-300.0000', '1.0000'),
         held('EUR', TIME + 2 * SECOND, '900.0000')
      ])

      expect(balances.find(({ id }) => id === 'W1')?.balance).toEqual({ after: '699', low: '100', high: '5000' })
   })

   test('counts every entry of the same second, whichever order they come in', () => {

      const balances = withBalances(movements, [
         held('EUR', TIME + 2 * SECOND, '-300.0000', '1.0000'),
         held('EUR', TIME, '25.0000'),
         held('EUR', TIME, '1000.0000')
      ])

      expect(balances.find(({ id }) => id === 'D1')?.balance).toEqual({ after: '1025', low: '0', high: '1025' })
      expect(balances.find(({ id }) => id === 'W1')?.balance).toEqual({ after: '724', low: '724', high: '1025' })
   })

   test('holds nothing of an asset the ledger has no entry for', () => {
      expect(withBalances(movements, []).map(({ balance }) => balance?.after)).toEqual(['0', '0', '0'])
   })
})
