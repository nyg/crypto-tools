import Big from 'big.js'

export interface TakeProfitTier {
   pct: number
   rMultiple: number | null
}

export interface TakeProfitStrategy {
   label: string
   tiers: TakeProfitTier[]
}

export interface TakeProfitLevel {
   label: string
   rMultiple: number | null
   pct: number
   price: Big | null
   quantity: Big | null
   profit: Big | null
   roi: Big | null
}

// What the form holds: free text as the user typed it, parsed here rather than on
// every keystroke.
export interface TradeCalculatorForm {
   direction?: string
   strategy?: string
   portfolioValue?: string
   riskPct?: string
   entryPrice?: string
   stopLoss?: string
}


export const tpStrategies: Record<string, TakeProfitStrategy> = {
   conservative: {
      label: 'Conservative (2 tiers)',
      tiers: [
         { pct: 50, rMultiple: 2 },
         { pct: 50, rMultiple: 4 }
      ]
   },
   normal: {
      label: 'Normal (3 tiers)',
      tiers: [
         { pct: 33, rMultiple: 2 },
         { pct: 33, rMultiple: 3 },
         { pct: 34, rMultiple: 5 }
      ]
   },
   aggressive: {
      label: 'Aggressive (4 tiers)',
      tiers: [
         { pct: 25, rMultiple: 1.5 },
         { pct: 25, rMultiple: 3 },
         { pct: 25, rMultiple: 5 },
         { pct: 25, rMultiple: null }
      ]
   }
}

export const strategyOptions =
   Object.entries(tpStrategies).map(([value, strategy]) => ({ value, label: strategy.label }))

export const directionOptions = [
   { value: 'buy', label: 'Buy (long)' },
   { value: 'sell', label: 'Sell (short)' }
]

const positive = (value: string | number | null | undefined): Big | null => {
   if (value === null || value === undefined || value === '') return null
   try {
      const parsed = Big(value)
      return parsed.gt(0) ? parsed : null
   }
   catch {
      return null
   }
}

const tierPrice = (tier: TakeProfitTier, entryPrice: Big, riskPerUnit: Big, isLong: boolean): Big | null => {
   if (tier.rMultiple === null) return null
   const move = riskPerUnit.times(tier.rMultiple)
   const price = isLong ? entryPrice.plus(move) : entryPrice.minus(move)
   return price.gt(0) ? price : null
}

const tierLevel = (
   tier: TakeProfitTier, entryPrice: Big, riskPerUnit: Big, positionSize: Big | null, isLong: boolean
): TakeProfitLevel => {

   const price = tierPrice(tier, entryPrice, riskPerUnit, isLong)
   const quantity = positionSize ? positionSize.times(tier.pct).div(100) : null
   const cost = quantity ? entryPrice.times(quantity) : null

   const profit = price && quantity
      ? (isLong ? price.minus(entryPrice) : entryPrice.minus(price)).times(quantity)
      : null

   return {
      label: tier.rMultiple === null ? 'Runner' : `${tier.rMultiple}R`,
      rMultiple: tier.rMultiple,
      pct: tier.pct,
      price,
      quantity,
      profit,
      roi: profit && cost && cost.gt(0) ? profit.div(cost) : null
   }
}

const totalsOf = (tpLevels: TakeProfitLevel[], positionValue: Big | null) => {

   const pct = tpLevels.reduce((sum, level) => sum + level.pct, 0)

   const quantity = tpLevels.reduce(
      (sum, level) => level.quantity ? sum.plus(level.quantity) : sum, Big(0))

   const withProfit = tpLevels.filter(level => level.profit)
   const profit = withProfit.length > 0
      ? withProfit.reduce((sum, level) => sum.plus(level.profit!), Big(0))
      : null

   return {
      pct,
      quantity,
      profit,
      roi: profit && positionValue?.gt(0) ? profit.div(positionValue) : null
   }
}

export function calculate(formValues: TradeCalculatorForm) {

   const direction = formValues.direction === 'sell' ? 'sell' : 'buy'
   const isLong = direction === 'buy'

   const portfolioValue = positive(formValues.portfolioValue)
   const riskPct = positive(formValues.riskPct)
   const entryPrice = positive(formValues.entryPrice)
   const stopLoss = positive(formValues.stopLoss)

   const errors: string[] = []

   const riskTooLarge = riskPct !== null && riskPct.gt(100)
   if (riskTooLarge) {
      errors.push('Risk cannot exceed 100% of the portfolio.')
   }

   const stopOnWrongSide = entryPrice !== null && stopLoss !== null &&
      (isLong ? stopLoss.gte(entryPrice) : stopLoss.lte(entryPrice))
   if (stopOnWrongSide) {
      errors.push(isLong
         ? 'For a buy the stop loss must sit below the entry price.'
         : 'For a sell the stop loss must sit above the entry price.')
   }

   const riskAmount = portfolioValue && riskPct && !riskTooLarge
      ? portfolioValue.times(riskPct).div(100)
      : null

   const riskPerUnit = entryPrice && stopLoss && !stopOnWrongSide
      ? entryPrice.minus(stopLoss).abs()
      : null

   const positionSize = riskAmount && riskPerUnit ? riskAmount.div(riskPerUnit) : null
   const positionValue = positionSize && entryPrice ? positionSize.times(entryPrice) : null
   const stopDistance = riskPerUnit && entryPrice ? riskPerUnit.div(entryPrice) : null
   const leverage = positionValue && portfolioValue ? positionValue.div(portfolioValue) : null

   const strategy = tpStrategies[formValues.strategy ?? '']
   const tpLevels = strategy && entryPrice && riskPerUnit
      ? strategy.tiers.map(tier => tierLevel(tier, entryPrice, riskPerUnit, positionSize, isLong))
      : []

   return {
      direction,
      isLong,
      strategyLabel: strategy?.label,
      portfolioValue,
      riskPct,
      entryPrice,
      stopLoss,
      riskAmount,
      riskPerUnit,
      positionSize,
      positionValue,
      stopDistance,
      leverage,
      tpLevels,
      totals: tpLevels.length > 0 ? totalsOf(tpLevels, positionValue) : null,
      errors
   }
}

export const chartSymbol = (pair: string | undefined, override?: string): string => {

   const explicit = (override ?? '').trim().toUpperCase()
   if (explicit) return explicit

   const cleaned = (pair ?? '').trim().toUpperCase().replace(/[^A-Z0-9:]/g, '')
   if (!cleaned) return ''

   return cleaned.includes(':') ? cleaned : `BINANCE:${cleaned}`
}
