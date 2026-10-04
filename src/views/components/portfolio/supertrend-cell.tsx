import type { ReactNode } from 'react'
import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TableCell, TableHead } from '@/components/ui/table'
import { asQuantity, asSignedPercent, flipDistance, flipExtension, flipPending } from './format'
import type { SupertrendLevel, SupertrendLevels, SupertrendTrend } from '../../../types/api'

export interface SupertrendColumns {
   levels: Record<string, SupertrendLevels> | undefined
   loading: boolean
}

const trendColors: Record<SupertrendTrend, string> = {
   up: 'text-emerald-600 dark:text-emerald-400',
   down: 'text-destructive'
}

const trendNames: Record<SupertrendTrend, string> = { up: 'Uptrend', down: 'Downtrend' }
const flipSides: Record<SupertrendTrend, string> = { up: 'below', down: 'above' }

const trendTitle = ({ trend }: SupertrendLevel, timeframe: string, pending: boolean) => pending
   ? `${trendNames[trend]}, but the price is already ${flipSides[trend]} the flip price. `
      + `The trend flips if the ${timeframe} candle closes there.`
   : `${trendNames[trend]}. It flips if the ${timeframe} candle closes ${flipSides[trend]} this price.`

const supertrendHint = (timeframe: string) => [
   `Supertrend (10, 3) on the ${timeframe} chart.`,
   'Price: the level where the trend flips. Green in an uptrend, red in a downtrend.',
   'Top %: how far the current price is beyond that level.',
   `Bottom %: how far it has to move back for a ${timeframe} close to flip the trend.`
].join('\n')

export const SupertrendHead = ({ timeframe, children }: { timeframe: string, children: ReactNode }) =>
   <TableHead className="text-right">
      <span className="cursor-help underline decoration-dotted underline-offset-2" title={supertrendHint(timeframe)}>
         {children}
      </span>
   </TableHead>

const MINUS_SIGN = '−'

const Move = ({ percent }: { percent: string }) => {
   const falling = Number(percent) < 0
   const Arrow = falling ? TrendingDownIcon : TrendingUpIcon
   const color = trendColors[falling ? 'down' : 'up']
   return (
      <>
         <Arrow className={cn('size-3', color)} />
         <span className={color}>{asSignedPercent(percent).replace('-', MINUS_SIGN)}</span>
      </>
   )
}

export const SupertrendCell = ({ level, price, loading, timeframe }: {
   level: SupertrendLevel | null | undefined
   price: string | null
   loading: boolean
   timeframe: string
}) => {
   if (!level) return <TableCell className="text-right text-muted-foreground">{loading ? '…' : '—'}</TableCell>
   const extension = flipExtension(level.flipPrice, price)
   const distance = flipDistance(level.flipPrice, price)
   const pending = flipPending(level, price)
   return (
      <TableCell className="text-right" title={trendTitle(level, timeframe, pending)}>
         <div className="flex items-center justify-end gap-2">
            <span className={trendColors[level.trend]}>{asQuantity(level.flipPrice)}</span>
            {extension !== null && distance !== null &&
               <div className="grid grid-cols-[auto_auto] items-center gap-x-0.5 text-xs leading-tight">
                  <Move percent={extension} />
                  {pending
                     ? <span className="col-span-2 text-amber-600 dark:text-amber-400">flips at close</span>
                     : <Move percent={distance} />}
               </div>}
         </div>
      </TableCell>
   )
}
