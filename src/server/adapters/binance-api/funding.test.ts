import { describe, expect, test } from 'bun:test'
import { depositRecord, fiatRecord, withdrawalRecord } from './funding'
import type { BinanceDeposit, BinanceFiatOrder, BinanceWithdrawal } from '../../../types/binance-api'

const deposit: BinanceDeposit = {
   id: '769800519366885376', txId: '98A3EA56', coin: 'BNB', network: 'BNB', amount: '0.00100000',
   status: 1, insertTime: 1661493146000, transferType: 0
}

const withdrawal: BinanceWithdrawal = {
   id: 'b6ae22b3aa844210a7041aee7589627c', coin: 'USDT', network: 'ETH', amount: '8.91000000',
   transactionFee: '0.004', status: 6, applyTime: '2019-10-12 11:12:02', transferType: 0
}

const fiatOrder: BinanceFiatOrder = {
   orderNo: '7d76d611', fiatCurrency: 'EUR', indicatedAmount: '100.00', amount: '99.00', totalFee: '1.00',
   method: 'BankAccount', status: 'Successful', createTime: 1626144956000
}

describe('Binance deposits', () => {

   test('map to a record credited at the time Binance first saw it, with no fee', () => {
      expect(depositRecord(deposit)).toEqual({
         id: '769800519366885376', kind: 'deposit', asset: 'BNB', amount: '0.001', fee: '0',
         method: 'BNB', status: 'completed', time: 1661493146000
      })
   })

   test('count as completed once credited, pending while confirming and failed when rejected', () => {
      const statusOf = (status: number) => depositRecord({ ...deposit, status }).status
      expect([0, 1, 2, 6, 7, 8, 99].map(statusOf))
         .toEqual(['pending', 'completed', 'failed', 'completed', 'failed', 'pending', 'pending'])
   })

   test('name a transfer between Binance accounts rather than its network', () => {
      expect(depositRecord({ ...deposit, transferType: 1 }).method).toBe('Internal')
   })

   test('fall back to the transaction when Binance wrote no id', () => {
      expect(depositRecord({ ...deposit, id: undefined }).id).toBe('98A3EA56')
   })
})

describe('Binance withdrawals', () => {

   test('read the time Binance writes as a UTC string, and keep the fee apart from the amount sent', () => {
      expect(withdrawalRecord(withdrawal)).toEqual({
         id: 'b6ae22b3aa844210a7041aee7589627c', kind: 'withdrawal', asset: 'USDT', amount: '8.91', fee: '0.004',
         method: 'ETH', status: 'completed', time: Date.UTC(2019, 9, 12, 11, 12, 2)
      })
   })

   test('count as completed only once sent, and as failed when cancelled, rejected or failed', () => {
      const statusOf = (status: number) => withdrawalRecord({ ...withdrawal, status }).status
      expect([0, 1, 2, 3, 4, 5, 6].map(statusOf))
         .toEqual(['pending', 'failed', 'pending', 'failed', 'pending', 'failed', 'completed'])
   })

   test('take an old withdrawal that carries neither network nor fee', () => {
      expect(withdrawalRecord({ ...withdrawal, network: undefined, transactionFee: undefined }))
         .toMatchObject({ method: '', fee: '0' })
   })
})

describe('Binance fiat orders', () => {

   test('count what was sent for a deposit and what arrived for a withdrawal', () => {
      expect(fiatRecord(fiatOrder, 'deposit')).toEqual({
         id: '7d76d611', kind: 'deposit', asset: 'EUR', amount: '100', fee: '1',
         method: 'BankAccount', status: 'completed', time: 1626144956000
      })
      expect(fiatRecord(fiatOrder, 'withdrawal')).toMatchObject({ kind: 'withdrawal', amount: '99', fee: '1' })
   })

   test('count as failed whatever did not go through', () => {
      const statusOf = (status: string) => fiatRecord({ ...fiatOrder, status }, 'deposit').status
      expect(['Processing', 'Successful', 'Finished', 'Failed', 'Expired', 'Refunded'].map(statusOf))
         .toEqual(['pending', 'completed', 'completed', 'failed', 'failed', 'failed'])
   })
})
