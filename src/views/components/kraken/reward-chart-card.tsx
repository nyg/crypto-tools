import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Donut, { foldSlices } from './donut'
import { ValuationTag, usdOf } from './reward-valuation'
import type { RewardSummary } from '../../../types/api'
import type { UsdRates } from '../../../types/kraken'
import type { Valuation } from './reward-valuation'


export default function RewardChartCard({ rewards, rates, valuation }: {
   rewards?: RewardSummary
   rates?: UsdRates
   valuation: Valuation
}) {

   const slices = foldSlices((rewards?.assets ?? [])
      .map(asset => ({ asset, value: usdOf(asset.total, rates?.[asset.asset], valuation).value }))
      .filter((slice): slice is typeof slice & { value: number } => slice.value != null)
      .map(({ asset, value }) => ({
         key: asset.asset,
         label: asset.asset,
         value,
         amount: asset.total.amount
      })))

   return (
      <Card>
         <CardHeader>
            <CardTitle>Share of rewards<ValuationTag valuation={valuation} /></CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">
            <Donut
               slices={slices}
               emptyText="Nothing to chart: none of the rewarded assets could be valued in USD." />
         </CardContent>
      </Card>
   )
}
