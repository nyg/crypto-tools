import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Donut, { foldSlices } from './donut'
import type { BalanceSummary } from '../../../types/api'
import type { UsdRates } from '../../../types/kraken'


export default function BalanceChartCard({ balances, rates }: {
   balances?: BalanceSummary
   rates?: UsdRates
}) {

   const priced = rates ?? {}

   const slices = foldSlices((balances?.assets ?? [])
      .filter(asset => priced[asset.asset] != null)
      .map(asset => ({
         key: asset.asset,
         label: asset.asset,
         value: asset.totalNum * priced[asset.asset],
         amount: asset.totalNum
      })))

   return (
      <Card>
         <CardHeader>
            <CardTitle>Allocation</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">
            <Donut
               slices={slices}
               emptyText="Nothing to chart: none of the assets held could be valued in USD." />
         </CardContent>
      </Card>
   )
}
