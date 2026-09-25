import Big from 'big.js'
import { normalizeAsset } from './assets'
import type { LivePosition } from '../../../types/kraken'
import type { KrakenEarnAllocation, KrakenEarnAmount, KrakenEarnStrategy } from '../../../types/kraken-api'

const DAY_SECONDS = 86400

const nativeOf = (amount: KrakenEarnAmount | undefined): Big => Big(amount?.native || 0)

const aprOf = (percent: string | undefined): number | null =>
   percent === undefined ? null : Number(Big(percent).div(100))

function idlePosition(amount: Big): LivePosition {
   return {
      strategyId: null,
      lockType: '',
      yieldSource: '',
      amount: amount.toFixed(),
      amountNum: Number(amount),
      bonding: '0',
      unbonding: '0',
      aprLow: null,
      aprHigh: null,
      unbondingDays: null
   }
}

function allocatedPosition(allocation: KrakenEarnAllocation, strategy: KrakenEarnStrategy | undefined): LivePosition {

   const amount = nativeOf(allocation.amount_allocated.total)
   const unbondingPeriod = strategy?.lock_type.unbonding_period

   return {
      strategyId: allocation.strategy_id,
      lockType: strategy?.lock_type.type ?? '',
      yieldSource: strategy?.yield_source?.type ?? '',
      amount: amount.toFixed(),
      amountNum: Number(amount),
      bonding: nativeOf(allocation.amount_allocated.bonding).toFixed(),
      unbonding: nativeOf(allocation.amount_allocated.unbonding).toFixed(),
      aprLow: aprOf(strategy?.apr_estimate?.low),
      aprHigh: aprOf(strategy?.apr_estimate?.high),
      unbondingDays: unbondingPeriod ? unbondingPeriod / DAY_SECONDS : null
   }
}

export function earnPositions(
   totals: Map<string, Big>, allocations: KrakenEarnAllocation[], strategies: KrakenEarnStrategy[]
): Map<string, LivePosition[]> {

   const strategyById = new Map(strategies.map(strategy => [strategy.id, strategy]))
   const allocated = new Map<string, LivePosition[]>()

   for (const allocation of allocations) {
      if (nativeOf(allocation.amount_allocated.total).eq(0)) continue

      const asset = normalizeAsset(allocation.native_asset)
      const position = allocatedPosition(allocation, strategyById.get(allocation.strategy_id))
      allocated.set(asset, [...allocated.get(asset) ?? [], position])
   }

   return new Map([...totals].map(([asset, total]) => {
      const positions = allocated.get(asset) ?? []
      const idle = positions.reduce((rest, position) => rest.minus(position.amount), total)
      return [asset, idle.gt(0) ? [idlePosition(idle), ...positions] : positions]
   }))
}
