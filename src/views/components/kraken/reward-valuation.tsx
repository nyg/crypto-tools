import type { RewardAmount } from '../../../types/api'
import type { UsdValue } from '../../../types/db'

export type Valuation = 'received' | 'today'

export const valuationLabels: Record<Valuation, string> = {
   received: 'when received',
   today: 'today'
}

export const otherValuation = (valuation: Valuation): Valuation => valuation === 'received' ? 'today' : 'received'

export const reviveValuation = (stored: Valuation, fallback: Valuation): Valuation =>
   stored in valuationLabels ? stored : fallback

// An asset Kraken has no USD pair for has no rate at all, which is not the same as
// being worth nothing: it is left out of the totals, shown as a dash, and sorted last
// whichever column is sorted on.
export function usdOf(amount: RewardAmount | undefined, rate: number | null | undefined, valuation: Valuation): UsdValue {
   if (!amount) return { value: null, unvalued: 0 }
   if (valuation === 'received') return { value: amount.value, unvalued: amount.unvalued }
   return rate == null
      ? { value: null, unvalued: amount.amount }
      : { value: amount.amount * rate, unvalued: 0 }
}

export const ValuationTag = ({ valuation }: { valuation: Valuation }) =>
   <span className="font-normal text-muted-foreground"> · {valuationLabels[valuation]}</span>
