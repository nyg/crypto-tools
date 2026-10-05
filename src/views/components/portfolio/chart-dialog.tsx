import TradingViewChart from '../tools/tradingview-chart'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface ChartPair {
   asset: string
   quote: string
}

interface ChartDialogProps {
   venueLabel: string
   chartExchange: string
   pair: ChartPair | null
   onOpenChange: (open: boolean) => void
}

export default function ChartDialog({ venueLabel, chartExchange, pair, onOpenChange }: ChartDialogProps) {

   const symbol = pair ? `${chartExchange}:${pair.asset}${pair.quote}` : ''

   return (
      <Dialog open={pair !== null} onOpenChange={onOpenChange}>
         <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
               <DialogTitle>{pair?.asset}/{pair?.quote} on {venueLabel}</DialogTitle>
               <DialogDescription>{symbol} on TradingView.</DialogDescription>
            </DialogHeader>
            {pair &&
               <div className="h-[70svh] overflow-hidden rounded-lg border border-border">
                  <TradingViewChart symbol={symbol} />
               </div>}
         </DialogContent>
      </Dialog>
   )
}
