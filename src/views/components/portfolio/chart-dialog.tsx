import TradingViewChart from '../tools/tradingview-chart'
import Checkbox from '../lib/checkbox'
import usePersistentState from '../../lib/use-persistent-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const SUPERTREND = ['STD;Supertrend']
const NO_STUDIES: string[] = []

const intervals = [
   { value: '60', label: '1h' },
   { value: '240', label: '4h' },
   { value: 'D', label: '1D' },
   { value: 'W', label: '1W' }
]

interface ChartSettings {
   interval: string
   supertrend: boolean
}

const DEFAULT_SETTINGS: ChartSettings = { interval: 'D', supertrend: true }

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

   const [settings, setSettings] = usePersistentState<ChartSettings>('portfolios.chart', DEFAULT_SETTINGS)
   const symbol = pair ? `${chartExchange}:${pair.asset}${pair.quote}` : ''

   return (
      <Dialog open={pair !== null} onOpenChange={onOpenChange}>
         <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
               <DialogTitle>{pair?.asset}/{pair?.quote} on {venueLabel}</DialogTitle>
               <DialogDescription>
                  {symbol} on TradingView. Every chart opens on the timeframe and with the indicator picked
                  here; what you change inside the chart itself lasts until it closes.
               </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-4">
               <Tabs
                  value={settings.interval}
                  onValueChange={interval => setSettings(current => ({ ...current, interval }))}>
                  <TabsList>
                     {intervals.map(({ value, label }) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}
                  </TabsList>
               </Tabs>
               <Checkbox
                  name="chart-supertrend"
                  checked={settings.supertrend}
                  onChange={event => setSettings(current => ({ ...current, supertrend: event.target.checked }))}
                  label="Supertrend (10, 3)" />
            </div>
            {pair &&
               <div className="h-[65svh] overflow-hidden rounded-lg border border-border">
                  <TradingViewChart
                     symbol={symbol}
                     interval={settings.interval}
                     studies={settings.supertrend ? SUPERTREND : NO_STUDIES} />
               </div>}
         </DialogContent>
      </Dialog>
   )
}
