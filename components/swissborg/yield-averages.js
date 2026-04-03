import useSWR from 'swr'
import { multiplierFor } from '@/utils/swissborg-config'
import * as format from '@/utils/format'
import {
   Table, TableHeader, TableBody, TableHead, TableRow, TableCell
} from '@/components/ui/table'


export default function YieldAverages({ className, yieldRate = 'genesis' }) {

   const { data, error } = useSWR('/api/swissborg/yield-average')

   if (error) return <div className="text-center pt-4 text-muted-foreground">Failed to load yield averages!</div>
   if (!data) return <div className="text-center pt-4 text-muted-foreground">Loading yield averages…</div>

   const assetsOf = object => Object.keys(object).filter(k => k != 'date')

   const yieldAverages = data.yieldAverages.map(average =>
      assetsOf(average).reduce((newAverage, asset) => {
         newAverage[asset] = average[asset] * multiplierFor[yieldRate]
         return newAverage
      }, { date: average.date })
   )

   return (
      <div className={className}>
         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead></TableHead>
                  {data.assets.map(asset => (
                     <TableHead key={asset} className="text-right text-xs">{asset}</TableHead>
                  ))}
               </TableRow>
            </TableHeader>
            <TableBody>
               {yieldAverages.map((average, index) => (
                  <TableRow key={average.date} className={index === 0 ? 'italic' : ''}>
                     <TableCell className="text-xs">{format.asMonthYearDate(average.date)}</TableCell>
                     {data.assets.map(asset =>
                        <TableCell key={asset} className="text-right tabular-nums text-xs">
                           {average[asset]
                              ? format.asPercentage(average[asset])
                              : ''}
                        </TableCell>
                     )}
                  </TableRow>
               ))}
            </TableBody>
         </Table>
      </div>
   )
}
