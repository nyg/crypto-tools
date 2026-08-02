import { Loader2Icon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Field from '../lib/field'
import { asCount } from '../lib/filter-options'
import { asDollarAmount, asLongDate } from '../../../utils/format'


export default function RewardSummaryCard({ rewards, rates, isLoading, isLoadingRates }) {

   const assets = rewards?.assets ?? []
   const entries = rewards?.entries ?? 0

   const valued = assets.filter(asset => rates?.[asset.asset] != null)
   const totalValue = valued.reduce((sum, asset) => sum + asset.total * rates[asset.asset], 0)

   return (
      <Card>
         <CardHeader>
            <CardTitle>Rewards earned</CardTitle>
            <CardAction>
               {isLoading
                  ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  : <Badge variant="outline">{asCount(entries, 'reward')}</Badge>}
            </CardAction>
         </CardHeader>
         {/* The chart beside this card is the taller of the two, so the stats are centred
             in whatever height it sets rather than left hanging at the top. */}
         <CardContent className="flex flex-1 items-center">
            {/* Two columns rather than four: the card sits beside the chart, and the
                stats read better stacked in a narrow column than squeezed into one row. */}
            <div className="grid w-full grid-cols-2 gap-x-6 gap-y-8">
               <Field label="Assets rewarded">{assets.length.toLocaleString('en-GB')}</Field>
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
