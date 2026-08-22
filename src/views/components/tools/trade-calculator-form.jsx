import Input from '../lib/input'
import NumericInput from '../lib/numeric-input'
import SelectField from '../lib/select-field'
import FieldHint from '../lib/field-hint'
import Field from '../lib/field'
import { asAssetAmount, asDollarAmount, asPercentage } from '../../../utils/format'
import { directionOptions, strategyOptions } from '@/lib/trade-calculator'

const Section = ({ title, children }) => (
   <section className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children}
   </section>
)

const Grid = ({ children }) => (
   <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</div>
)

export default function TradeCalculatorForm({ formValues, setFormValues, result }) {

   const handleChange = (name, value) => {
      setFormValues(prev => ({ ...prev, [name]: value }))
   }

   return (
      <form onSubmit={event => event.preventDefault()} className="space-y-4">

         <Section title="Pair info">
            <Grid>
               <Input
                  name="pair"
                  label="Trading pair"
                  hint={
                     <FieldHint label="About the trading pair">
                        Optional. Used to label the summary and to pick the chart symbol on the
                        right, which you can still override there.
                     </FieldHint>
                  }
                  value={formValues.pair}
                  onChange={event => handleChange('pair', event.target.value)}
               />
               <Input
                  name="token-address"
                  label="Token address"
                  hint={
                     <FieldHint label="About the token address">
                        Optional contract address, carried into the copied summary so a note about
                        the trade says exactly which token it was.
                     </FieldHint>
                  }
                  value={formValues.tokenAddress}
                  onChange={event => handleChange('tokenAddress', event.target.value)}
               />
            </Grid>
         </Section>

         <Section title="Portfolio & risk">
            <Grid>
               <NumericInput
                  name="portfolio-value"
                  label="Portfolio value (USD)"
                  value={formValues.portfolioValue}
                  onChange={event => handleChange('portfolioValue', event.target.value)}
               />
               <NumericInput
                  name="risk-pct"
                  label="Risk (%)"
                  value={formValues.riskPct}
                  onChange={event => handleChange('riskPct', event.target.value)}
               />
            </Grid>
            {result.riskAmount &&
               <Field label="Risk amount">{asDollarAmount(result.riskAmount.toNumber())}</Field>}
         </Section>

         <Section title="Entry & stop loss">
            <SelectField
               name="direction"
               label="Direction"
               value={formValues.direction}
               onValueChange={value => handleChange('direction', value)}
               options={directionOptions}
               className="sm:w-[calc(50%-0.5rem)]"
            />
            <Grid>
               <NumericInput
                  name="entry-price"
                  label="Entry price"
                  value={formValues.entryPrice}
                  onChange={event => handleChange('entryPrice', event.target.value)}
               />
               <NumericInput
                  name="stop-loss"
                  label="Stop loss price"
                  value={formValues.stopLoss}
                  onChange={event => handleChange('stopLoss', event.target.value)}
               />
            </Grid>
            {result.positionValue &&
               <div className="grid grid-cols-3 gap-x-4">
                  <Field label="Position value">{asDollarAmount(result.positionValue.toNumber())}</Field>
                  <Field label="Position size">{asAssetAmount(result.positionSize.toNumber())}</Field>
                  <Field label="Stop distance">{asPercentage(result.stopDistance.toNumber())}</Field>
               </div>}
         </Section>

         <Section title="Take profit">
            <SelectField
               name="strategy"
               label="Strategy"
               value={formValues.strategy}
               onValueChange={value => handleChange('strategy', value)}
               options={strategyOptions}
               placeholder="Select a strategy"
               className="sm:w-1/2 sm:pr-2"
            />
         </Section>

      </form>
   )
}
