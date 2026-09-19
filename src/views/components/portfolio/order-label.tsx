import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { OrderSide } from '../../../types/portfolio'

const sideColours: Record<OrderSide, string> = {
   buy: 'bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
   sell: 'bg-rose-600/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300'
}

export default function OrderLabel({ side, asset }: { side: OrderSide, asset: string }) {
   return (
      <div className="flex items-center gap-2">
         <Badge className={cn('w-10 capitalize', sideColours[side])}>{side}</Badge>
         <span className="font-medium">{asset}</span>
      </div>
   )
}
