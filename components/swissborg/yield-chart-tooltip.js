import React from 'react'
import * as format from '@/utils/format'


export default function YieldChartTooltip({ active, payload, label }) {
   if (!active || !payload?.length) return null

   return (
      <div className="grid grid-cols-2 rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-md opacity-100">
         <div className="col-span-2 text-center border-b border-border mb-2 pb-1">
            {format.asLongDate(label)}
         </div>
         {payload
            .sort((a, b) => b.value - a.value)
            .map(_yield => (
               <React.Fragment key={_yield.dataKey}>
                  <div className="pr-3">{_yield.dataKey}</div>
                  <div className="text-right tabular-nums">{format.asPercentage(_yield.value / 100)}</div>
               </React.Fragment>
            ))}
      </div>
   )
}
