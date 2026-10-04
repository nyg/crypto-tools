import Big from 'big.js'
import type { FundingMovement } from '../../types/api'

export type FundingGranularity = 'day' | 'month' | 'year'

export interface FundingAsset {
   asset: string
   count: number
}

export interface FundingTotals {
   deposited: string
   withdrawn: string
   net: string
   fees: string
}

export interface FundingBucket {
   start: number
   deposited: number
   withdrawn: number
   net: number
   balance: number | null
   balanceRange: [number, number] | null
   count: number
}

const bucketStarts: Record<FundingGranularity, (date: Date) => number> = {
   day: date => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
   month: date => new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
   year: date => new Date(date.getFullYear(), 0, 1).getTime()
}

const sumOf = (movements: FundingMovement[], field: 'amount' | 'fee'): Big =>
   movements.reduce((sum, movement) => sum.plus(movement[field] || 0), Big(0))

export function fundingAssets(movements: FundingMovement[]): FundingAsset[] {

   const counts = new Map<string, number>()
   for (const { asset } of movements) counts.set(asset, (counts.get(asset) ?? 0) + 1)

   return [...counts]
      .map(([asset, count]) => ({ asset, count }))
      .toSorted((a, b) => b.count - a.count || a.asset.localeCompare(b.asset))
}

export function fundingTotals(movements: FundingMovement[]): FundingTotals {

   const deposited = sumOf(movements.filter(({ kind }) => kind === 'deposit'), 'amount')
   const withdrawn = sumOf(movements.filter(({ kind }) => kind === 'withdrawal'), 'amount')

   return {
      deposited: deposited.toFixed(),
      withdrawn: withdrawn.toFixed(),
      net: deposited.minus(withdrawn).toFixed(),
      fees: sumOf(movements, 'fee').toFixed()
   }
}

// Only the periods something moved in get a bucket, so the chart draws them side by
// side however far apart they are. Withdrawals are negative, to hang below the axis.
// A period's balance is the one its last movement left, and its range runs from the
// lowest to the highest balance held since the period before.
export function fundingBuckets(movements: FundingMovement[], granularity: FundingGranularity): FundingBucket[] {

   const startOf = bucketStarts[granularity]
   const grouped = new Map<number, FundingMovement[]>()

   for (const movement of movements) {
      const start = startOf(new Date(movement.time))
      grouped.set(start, [...grouped.get(start) ?? [], movement])
   }

   let net = Big(0)

   return [...grouped]
      .toSorted(([a], [b]) => a - b)
      .map(([start, bucket]) => {
         const { deposited, withdrawn } = fundingTotals(bucket)
         net = net.plus(deposited).minus(withdrawn)
         const { balance } = bucket.reduce((last, movement) => movement.time >= last.time ? movement : last)
         const ranges = bucket.flatMap(movement => movement.balance ? [movement.balance] : [])
         return {
            start,
            deposited: Number(deposited),
            withdrawn: 0 - Number(withdrawn),
            net: net.toNumber(),
            balance: balance ? Number(balance.after) : null,
            balanceRange: ranges.length > 0
               ? [Math.min(...ranges.map(({ low }) => Number(low))), Math.max(...ranges.map(({ high }) => Number(high)))]
               : null,
            count: bucket.length
         }
      })
}
