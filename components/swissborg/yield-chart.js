import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import YieldChartTooltip from './yield-chart-tooltip'
import { colorFor, multiplierFor, defaultVisibleAssets } from '@/utils/swissborg-config'
import * as format from '@/utils/format'


const normalize = assetName => assetName.replace(/[()\s]+/g, '')

const getStoredVisibility = () => {
   if (typeof window === 'undefined') return {}
   try {
      const stored = localStorage.getItem('swissborg.visibility')
      return stored ? JSON.parse(stored) : {}
   }
   catch { return {} }
}

const saveVisibility = (visibility) => {
   localStorage.setItem('swissborg.visibility', JSON.stringify(visibility))
}

export default function YieldChart({ settings, onVisibilityChange }) {

   const [visibility, setVisibility] = useState(getStoredVisibility)

   const { lineType = 'monotone', yieldRate = 'genesis', timeFrame = '90' } = settings || {}

   const { data, error } = useSWR(`/api/swissborg/yield?timeFrame=${timeFrame}`)

   const isVisible = asset => {
      const key = normalize(asset)
      if (key in visibility) return visibility[key]
      return defaultVisibleAssets.has(asset)
   }

   useEffect(() => {
      if (data?.assets) {
         const visibilityMap = {}
         for (const asset of data.assets) {
            visibilityMap[asset] = isVisible(asset)
         }
         onVisibilityChange?.(visibilityMap)
      }
   }, [data?.assets, visibility])

   if (error) return <div className="text-center pt-4 text-muted-foreground">Failed to load data!</div>
   if (!data) return <div className="text-center pt-4 text-muted-foreground">Loading data…</div>

   const yields = data.yields.map(_yield =>
      Object.keys(_yield)
         .filter(key => key != 'date')
         .reduce((newYield, asset) => {
            newYield[asset] = _yield[asset] * multiplierFor[yieldRate]
            return newYield
         }, { date: _yield.date })
   )

   const toggle = line => {
      const key = normalize(line.dataKey)
      const newVisibility = { ...visibility, [key]: line.inactive }
      setVisibility(newVisibility)
      saveVisibility(newVisibility)
   }

   return (
      <ResponsiveContainer width="100%" height={600}>
         <LineChart data={yields} margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
               tickMargin={10} dataKey="date" scale="time" type="number"
               ticks={data.xTicks} domain={['auto', 'auto']}
               tickFormatter={format.asShortDate}
               className="text-xs fill-muted-foreground" />
            <YAxis
               tickMargin={10} unit="%"
               className="text-xs fill-muted-foreground" />

            {data.assets.map((asset, index) =>
               <Line
                  key={asset} dataKey={asset}
                  type={lineType} hide={!isVisible(asset)}
                  stroke={colorFor(index)} strokeWidth={1.5}
                  dot={lineType.includes('step') ? false : { r: 1, fill: colorFor(index) }} />)}

            <Tooltip
               content={<YieldChartTooltip />} offset={50}
               wrapperStyle={{ opacity: 1 }} />
            <Legend
               iconType="plainline" verticalAlign="bottom"
               onClick={toggle}
               wrapperStyle={{ paddingTop: '6px', cursor: 'pointer' }} />
         </LineChart>
      </ResponsiveContainer>
   )
}
