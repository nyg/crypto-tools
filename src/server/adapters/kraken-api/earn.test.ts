import Big from 'big.js'
import { describe, expect, test } from 'bun:test'
import { earnPositions } from './earn'
import type { KrakenEarnAllocation, KrakenEarnStrategy } from '../../../types/kraken-api'

const strategies: KrakenEarnStrategy[] = [
   {
      id: 'ESFLEX-BCH', asset: 'BCH', lock_type: { type: 'flex' },
      yield_source: { type: 'opt_in_rewards' }, apr_estimate: { low: '0.1000', high: '0.1000' }
   },
   {
      id: 'ESINSTANT-BTC', asset: 'BTC', lock_type: { type: 'instant', payout_frequency: 604800 },
      yield_source: { type: 'opt_in_rewards' }, apr_estimate: { low: '0.1000', high: '0.2500' }
   },
   {
      id: 'ESBONDED-DOT', asset: 'DOT',
      lock_type: { type: 'bonded', bonding_period: 0, unbonding_period: 172800, payout_frequency: 604800 },
      yield_source: { type: 'staking' }, apr_estimate: { low: '3.0900', high: '3.0900' }
   },
   {
      id: 'ESFLEX-DOT', asset: 'DOT', lock_type: { type: 'flex' },
      yield_source: { type: 'staking' }, apr_estimate: null
   }
]

const allocation = (
   strategyId: string, asset: string, total: string, fields: Partial<KrakenEarnAllocation> = {}
): KrakenEarnAllocation => ({
   strategy_id: strategyId,
   native_asset: asset,
   amount_allocated: { total: { native: total, converted: '0' } },
   ...fields
})

const totals = (entries: Record<string, string>) =>
   new Map(Object.entries(entries).map(([asset, total]) => [asset, Big(total)]))

describe('Kraken Earn positions', () => {

   test('carry the lock type, yield source and APR of the strategy they are allocated to', () => {
      const positions = earnPositions(totals({ BCH: '4.5' }), [allocation('ESFLEX-BCH', 'BCH', '4.5')], strategies)

      expect(positions.get('BCH')).toEqual([{
         strategyId: 'ESFLEX-BCH', lockType: 'flex', yieldSource: 'opt_in_rewards',
         amount: '4.5', amountNum: 4.5, bonding: '0', unbonding: '0',
         aprLow: 0.001, aprHigh: 0.001, unbondingDays: null
      }])
   })

   test('leave whatever no strategy holds as an idle spot position, listed first', () => {
      const positions = earnPositions(
         totals({ DOT: '1200.5' }),
         [allocation('ESBONDED-DOT', 'DOT', '1000'), allocation('ESFLEX-DOT', 'DOT', '0.5')],
         strategies)

      expect(positions.get('DOT')!.map(({ strategyId, amount }) => [strategyId, amount])).toEqual([
         [null, '200'], ['ESBONDED-DOT', '1000'], ['ESFLEX-DOT', '0.5']
      ])
   })

   test('give a fully allocated asset no idle position', () => {
      const positions = earnPositions(
         totals({ BTC: '0.35' }), [allocation('ESINSTANT-BTC', 'BTC', '0.35')], strategies)

      expect(positions.get('BTC')!.map(position => position.strategyId)).toEqual(['ESINSTANT-BTC'])
   })

   test('leave an asset with no allocation entirely in idle spot', () => {
      const positions = earnPositions(totals({ LINK: '12' }), [], strategies)

      expect(positions.get('LINK')).toEqual([expect.objectContaining({ strategyId: null, amount: '12' })])
   })

   test('turn the unbonding period into days and carry the amount still unbonding', () => {
      const positions = earnPositions(totals({ DOT: '1000' }), [
         allocation('ESBONDED-DOT', 'DOT', '1000', {
            amount_allocated: {
               total: { native: '1000', converted: '0' },
               unbonding: { native: '250', converted: '0' }
            }
         })
      ], strategies)

      expect(positions.get('DOT')![0]).toMatchObject({ unbondingDays: 2, unbonding: '250' })
   })

   test('match allocations to balances by normalized asset name', () => {
      const positions = earnPositions(totals({ BTC: '1' }), [allocation('ESINSTANT-BTC', 'XBT', '1')], strategies)

      expect(positions.get('BTC')!.map(position => position.strategyId)).toEqual(['ESINSTANT-BTC'])
   })

   test('keep an allocation whose strategy Kraken no longer lists, with no lock type', () => {
      const positions = earnPositions(totals({ BTC: '1' }), [allocation('ESRETIRED', 'BTC', '1')], strategies)

      expect(positions.get('BTC')).toEqual([expect.objectContaining({ strategyId: 'ESRETIRED', lockType: '' })])
   })

   test('skip allocations that hold nothing', () => {
      const positions = earnPositions(totals({ BCH: '2' }), [allocation('ESFLEX-BCH', 'BCH', '0')], strategies)

      expect(positions.get('BCH')!.map(position => position.strategyId)).toEqual([null])
   })
})
