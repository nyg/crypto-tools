import { describe, expect, test } from 'bun:test'
import { foldLedgerFunding } from './kraken-funding'
import type { FundingLedgerRow } from '../../../types/db'

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
         { id: 'D1', kind: 'deposit', asset: 'EUR', amount: '1000', fee: '1.5', method: '', time: TIME, pending: false },
         { id: 'W1', kind: 'withdrawal', asset: 'BTC', amount: '0.25', fee: '0.00015', method: '', time: TIME + 1, pending: false }
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
