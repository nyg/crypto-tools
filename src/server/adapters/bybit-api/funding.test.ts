import { describe, expect, test } from 'bun:test'
import { depositRecord, internalDepositRecord, withdrawalRecord } from './funding'
import type { BybitDeposit, BybitInternalDeposit, BybitWithdrawal } from '../../../types/bybit-api'

const READ_AT = Date.UTC(2026, 9, 4)

const deposit: BybitDeposit = {
   id: '160237231', txID: '04bf3fba', txIndex: '0', coin: 'USDT', chain: 'TRX', amount: '999.0496',
   depositFee: '', status: 3, successAt: '1742728163000'
}

const internalDeposit: BybitInternalDeposit = {
   id: '1103', coin: 'ETH', amount: '0.1', status: 2, createdTime: '1705393280'
}

const withdrawal: BybitWithdrawal = {
   withdrawId: '131629076', withdrawType: 0, coin: 'USDC', chain: 'ETH', amount: '41.43008',
   withdrawFee: '5', status: 'success', createTime: '1742738305000'
}

describe('Bybit deposits', () => {

   test('map to a record at the time the deposit succeeded, an empty fee counting as none', () => {
      expect(depositRecord(deposit, READ_AT)).toEqual({
         id: '160237231', kind: 'deposit', asset: 'USDT', amount: '999.0496', fee: '0',
         method: 'TRX', status: 'completed', time: 1742728163000
      })
   })

   test('take the time they were read at while they have not succeeded yet', () => {
      expect(depositRecord({ ...deposit, status: 2, successAt: '' }, READ_AT))
         .toMatchObject({ status: 'pending', time: READ_AT })
   })

   test('count as completed once credited, failed when refused or rolled back, pending otherwise', () => {
      const statusOf = (status: number) => depositRecord({ ...deposit, status }, READ_AT).status
      expect([0, 1, 2, 3, 4, 7, 10011, 10012, 70011, 70012, 70013].map(statusOf)).toEqual([
         'pending', 'pending', 'pending', 'completed', 'failed', 'pending',
         'pending', 'completed', 'failed', 'completed', 'pending'
      ])
   })

   test('fall back to the transaction when Bybit wrote no id', () => {
      expect(depositRecord({ ...deposit, id: undefined }, READ_AT).id).toBe('04bf3fba:0')
   })
})

describe('Bybit internal deposits', () => {

   test('read the time Bybit writes in seconds', () => {
      expect(internalDepositRecord(internalDeposit)).toEqual({
         id: '1103', kind: 'deposit', asset: 'ETH', amount: '0.1', fee: '0',
         method: 'Internal', status: 'completed', time: 1705393280000
      })
   })

   test('count as pending while processing and failed when refused', () => {
      const statusOf = (status: number) => internalDepositRecord({ ...internalDeposit, status }).status
      expect([1, 2, 3].map(statusOf)).toEqual(['pending', 'completed', 'failed'])
   })
})

describe('Bybit withdrawals', () => {

   test('keep the fee apart from the amount sent', () => {
      expect(withdrawalRecord(withdrawal)).toEqual({
         id: '131629076', kind: 'withdrawal', asset: 'USDC', amount: '41.43008', fee: '5',
         method: 'ETH', status: 'completed', time: 1742738305000
      })
   })

   test('name a transfer to another Bybit account rather than a chain', () => {
      expect(withdrawalRecord({ ...withdrawal, withdrawType: 1, chain: '' }).method).toBe('Internal')
   })

   test('count as completed only on success, and as failed when cancelled, rejected or failed', () => {
      const statusOf = (status: string) => withdrawalRecord({ ...withdrawal, status }).status
      expect(['SecurityCheck', 'Pending', 'BlockchainConfirmed', 'success', 'CancelByUser', 'Reject', 'Fail'].map(statusOf))
         .toEqual(['pending', 'pending', 'pending', 'completed', 'failed', 'failed', 'failed'])
   })
})
