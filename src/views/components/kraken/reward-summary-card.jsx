import { Loader2Icon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import Field from '../lib/field'
import { asDollarAmount, asNumber, asLongDate } from '../../../utils/format'


export default function RewardSummaryCard({ rewards, rates, isLoading, isLoadingRates }) {

   const assets = rewards?.assets ?? []

   const valued = assets.filter(asset => rates?.[asset.asset] != null)
   const totalValue = valued.reduce((sum, asset) => sum + asset.total * rates[asset.asset], 0)

   return (
      <Card>
         <CardHeader>
            <CardTitle>Rewards earned</CardTitle>
            {isLoading &&
               <CardAction>
                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
               </CardAction>}
         </CardHeader>
         <CardContent>
            <div className="grid grid-cols-1 gap-y-4">
               <Field label="Assets rewarded">{asNumber(assets.length)}</Field>
               <Field
                  label="Worth today"
                  title={valued.length < assets.length
                     ? `${assets.length - valued.length} asset(s) have no USD pair and are not counted`
                     : undefined}>
                  {isLoadingRates
                     ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                     : rates ? asDollarAmount(totalValue) : '—'}
               </Field>
               <Field label="First reward">{rewards?.first ? asLongDate(rewards.first) : '—'}</Field>
               <Field label="Last reward">{rewards?.last ? asLongDate(rewards.last) : '—'}</Field>
            </div>
         </CardContent>
      </Card>
   )
}
