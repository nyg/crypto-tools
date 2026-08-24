import { useMemo } from 'react'
import { TriangleAlertIcon } from 'lucide-react'
import ToolsLayout from '../../components/tools/tools-layout'
import TradeCalculatorForm from '../../components/tools/trade-calculator-form'
import TakeProfitTable from '../../components/tools/take-profit-table'
import TradeSummary from '../../components/tools/trade-summary'
import TradingViewChart from '../../components/tools/tradingview-chart'
import usePersistentState from '../../lib/use-persistent-state'
import { calculate, chartSymbol, isSized } from '../../lib/trade-calculator'
import type { TradeCalculatorForm as FormValues } from '../../lib/trade-calculator'
import { asDecimal } from '../../../utils/format'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'

const STORAGE_KEY = 'tools.tradeCalculator.formValues'

const defaultFormValues: FormValues = {
   pair: 'BTC/USDT',
   tokenAddress: '',
   portfolioValue: '10000',
   riskPct: '2',
   direction: 'buy',
   entryPrice: '',
   stopLoss: '',
   strategy: 'normal',
   chartSymbol: ''
}

export default function TradeCalculator() {

   const [formValues, setFormValues] = usePersistentState(STORAGE_KEY, defaultFormValues)

   const result = useMemo(() => calculate(formValues), [formValues])
   const symbol = chartSymbol(formValues.pair, formValues.chartSymbol)
   const derivedSymbol = chartSymbol(formValues.pair)

   const leverage = result.leverage

   return (
      <ToolsLayout name="Trade Calculator">
         <div className="flex flex-col gap-6 lg:flex-row">

            <div className="flex w-full flex-col gap-6 lg:w-[480px] lg:shrink-0">

               <Card size="sm">
                  <CardHeader>
                     <CardTitle>Parameters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <TradeCalculatorForm
                        formValues={formValues}
                        setFormValues={setFormValues}
                        result={result} />
                     {result.errors.map(error =>
                        <Alert key={error} variant="destructive">
                           <AlertDescription>{error}</AlertDescription>
                        </Alert>
                     )}
                     {leverage && leverage.gt(1) &&
                        <Alert>
                           <TriangleAlertIcon />
                           <AlertDescription>
                              The position is worth {asDecimal(leverage.toNumber())}× the
                              portfolio. Holding it needs margin, and the stop loss no longer caps
                              the loss at the risk amount.
                           </AlertDescription>
                        </Alert>}
                  </CardContent>
               </Card>

               <Card size="sm">
                  <CardHeader>
                     <CardTitle>Take profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <TakeProfitTable result={result} />
                  </CardContent>
               </Card>

               {isSized(result) && <TradeSummary formValues={formValues} result={result} />}

            </div>

            <Card size="sm" className="flex min-h-[560px] flex-col pb-0 lg:min-h-0 lg:flex-1">
               <CardHeader>
                  <CardTitle>Chart</CardTitle>
                  <CardAction>
                     <Input
                        name="chart-symbol"
                        aria-label="Chart symbol"
                        placeholder={derivedSymbol || 'BINANCE:BTCUSDT'}
                        className="h-8 w-52 font-mono text-xs"
                        autoComplete="off"
                        value={formValues.chartSymbol}
                        onChange={event => setFormValues((prev: FormValues) => ({ ...prev, chartSymbol: event.target.value }))} />
                  </CardAction>
               </CardHeader>
               <CardContent className="flex-1 px-0">
                  <div className="h-full w-full border-t border-border">
                     <TradingViewChart symbol={symbol} />
                  </div>
               </CardContent>
            </Card>

         </div>
      </ToolsLayout>
   )
}
