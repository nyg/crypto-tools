import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Donut, { foldSlices } from './donut'
import type { RewardSummary } from '../../../types/api'
import type { UsdRates } from '../../../types/kraken'


export default function RewardChartCard({ rewards, rates }: {
   rewards?: RewardSummary
   rates?: UsdRates
}) {

   const priced = rates ?? {}

   const slices = foldSlices((rewards?.assets ?? [])
      .filter(asset => priced[asset.asset] != null)
      .map(asset => ({
         key: asset.asset,
         label: asset.asset,
         value: asset.total * priced[asset.asset],
         amount: asset.total
      })))

   return (
      <Card>
         <CardHeader>
            <CardTitle>Share of rewards</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">
            <Donut
               slices={slices}
               emptyText="Nothing to chart: none of the rewarded assets could be valued in USD." />
         </CardContent>
      </Card>
   )
}
