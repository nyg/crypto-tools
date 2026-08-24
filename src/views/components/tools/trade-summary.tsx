import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { CopyIcon } from 'lucide-react'
import { asAssetAmount, asDollarAmount, asPercentage } from '../../../utils/format'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import type { SizedTrade, TakeProfitLevel, TradeCalculatorForm } from '@/lib/trade-calculator'

const directionLabel = (result: SizedTrade) => result.isLong ? 'Buy (long)' : 'Sell (short)'

const levelLine = (level: TakeProfitLevel) => {
   const price = level.price ? asAssetAmount(level.price.toNumber()) : 'no target'
   const quantity = level.quantity ? asAssetAmount(level.quantity.toNumber()) : '—'
   return `  • ${level.label} — ${level.pct}% @ ${price} (${quantity} units)`
}

const buildSummaryText = (formValues: TradeCalculatorForm, result: SizedTrade) => {

   const lines: string[] = []

   if (formValues.pair) {
      lines.push(formValues.tokenAddress
         ? `Pair: ${formValues.pair} (${formValues.tokenAddress})`
         : `Pair: ${formValues.pair}`)
   }

   lines.push(`Direction: ${directionLabel(result)}`)
   lines.push(`Position size: ${asAssetAmount(result.positionSize.toNumber())} units (${asDollarAmount(result.positionValue.toNumber())})`)
   lines.push(`Entry price: ${asAssetAmount(result.entryPrice.toNumber())}`)
   lines.push(`Stop loss: ${asAssetAmount(result.stopLoss.toNumber())} (${asPercentage(result.stopDistance.toNumber())} from entry)`)

   if (result.riskAmount) {
      lines.push(`Risk: ${asDollarAmount(result.riskAmount.toNumber())} (${asPercentage(result.riskPct!.div(100).toNumber())} of portfolio)`)
   }

   if (result.tpLevels.length > 0) {
      lines.push('')
      lines.push(`Take profit — ${result.strategyLabel}:`)
      result.tpLevels.forEach(level => lines.push(levelLine(level)))
   }

   return lines.join('\n')
}

const Row = ({ label, children }: { label: string, children: ReactNode }) => (
   <p>
      <span className="font-medium">{label}:</span>{' '}
      <span className="tabular-nums">{children}</span>
   </p>
)

export default function TradeSummary({ formValues, result }: {
   formValues: TradeCalculatorForm
   result: SizedTrade
}) {

   const copy = async () => {
      try {
         await navigator.clipboard.writeText(buildSummaryText(formValues, result))
         toast.success('Trade summary copied to the clipboard.')
      }
      catch {
         toast.error('Could not copy the trade summary.')
      }
   }

   return (
      <Card size="sm">
         <CardHeader>
            <CardTitle>Trade summary</CardTitle>
            <CardAction>
               <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  onClick={copy}
                  className="text-muted-foreground hover:text-foreground">
                  <CopyIcon />
                  <span className="sr-only">Copy the trade summary</span>
               </Button>
            </CardAction>
         </CardHeader>
         <CardContent className="space-y-1 text-sm">

            {formValues.pair &&
               <Row label="Pair">
                  {formValues.pair}
                  {formValues.tokenAddress &&
                     <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {formValues.tokenAddress}
                     </span>}
               </Row>}

            <Row label="Direction">{directionLabel(result)}</Row>
            <Row label="Position size">
               {asAssetAmount(result.positionSize.toNumber())} units ({asDollarAmount(result.positionValue.toNumber())})
            </Row>
            <Row label="Entry price">{asAssetAmount(result.entryPrice.toNumber())}</Row>
            <Row label="Stop loss">
               {asAssetAmount(result.stopLoss.toNumber())} ({asPercentage(result.stopDistance.toNumber())} from entry)
            </Row>

            {result.riskAmount &&
               <Row label="Risk">
                  {asDollarAmount(result.riskAmount.toNumber())} ({asPercentage(result.riskPct!.div(100).toNumber())} of portfolio)
               </Row>}

            {result.tpLevels.length > 0 &&
               <div className="space-y-1 border-t border-border pt-2">
                  <p className="font-medium">Take profit — {result.strategyLabel}</p>
                  <ul className="ml-4 list-outside list-disc space-y-0.5 tabular-nums text-muted-foreground">
                     {result.tpLevels.map(level =>
                        <li key={level.label}>
                           {level.label} — {level.pct}% @{' '}
                           {level.price ? asAssetAmount(level.price.toNumber()) : 'no target'}{' '}
                           ({level.quantity ? asAssetAmount(level.quantity.toNumber()) : '—'} units)
                        </li>
                     )}
                  </ul>
               </div>}

         </CardContent>
      </Card>
   )
}
