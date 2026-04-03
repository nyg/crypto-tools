import useSWR from 'swr'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import SwissBorgLayout from '@/components/swissborg/swissborg-layout'
import * as format from '@/utils/format'


export default function CommunityIndex() {

   const { data, error } = useSWR('/api/swissborg/community-index')

   if (error) return (
      <SwissBorgLayout name="Community Index">
         <div className="text-center pt-4 text-muted-foreground">Failed to load data!</div>
      </SwissBorgLayout>
   )

   if (!data) return (
      <SwissBorgLayout name="Community Index">
         <div className="text-center pt-4 text-muted-foreground">Loading data…</div>
      </SwissBorgLayout>
   )

   return (
      <SwissBorgLayout name="Community Index">
         <ResponsiveContainer width="100%" height={600}>
            <LineChart data={data.communityIndices} margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
               <Line type="stepAfter" name="Community Index Score" dataKey="value" stroke="#01c38d" strokeWidth={2} dot={false} />
               <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
               <XAxis
                  tickMargin={10} dataKey="date" scale="time" type="number"
                  interval={20} domain={['auto', 'auto']}
                  tickFormatter={format.asShortDate}
                  className="text-xs fill-muted-foreground" />
               <YAxis
                  tickMargin={10} domain={[4, 10]} tickCount={10}
                  tickFormatter={format.asDecimalOne}
                  className="text-xs fill-muted-foreground" />
               <Tooltip
                  formatter={value => [`${value}/10`, 'Score']}
                  labelFormatter={format.asLongDate}
                  contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--border)' }} />
               <Legend iconType="plainline" align="center" wrapperStyle={{ paddingTop: '6px' }} />
            </LineChart>
         </ResponsiveContainer>
      </SwissBorgLayout>
   )
}
