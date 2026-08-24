import { locales } from './locale'

// Every date helper here is handed either a millisecond timestamp or a Date.
type DateLike = number | Date

const shortDateFormatter = new Intl.DateTimeFormat(locales, { month: 'short', day: 'numeric' })
const longDateFormatter = new Intl.DateTimeFormat(locales, { year: 'numeric', month: 'short', day: 'numeric' })
const utcLongDateFormatter = new Intl.DateTimeFormat(locales, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthDateFormatter = new Intl.DateTimeFormat(locales, { year: 'numeric', month: 'long' })
const shortMonthDateFormatter = new Intl.DateTimeFormat(locales, { year: '2-digit', month: 'short' })
const percentageFormatter = new Intl.NumberFormat(locales, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const shortPercentageFormatter = new Intl.NumberFormat(locales, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const usDollarFormatter = new Intl.NumberFormat(locales, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const decimalOneFormatter = new Intl.NumberFormat(locales, { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const localTimestampFormatter = new Intl.DateTimeFormat(locales, {
   year: 'numeric', month: 'short', day: 'numeric',
   hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
})
const countFormatter = new Intl.NumberFormat(locales)
const compactFormatter = new Intl.NumberFormat(locales, { notation: 'compact', maximumFractionDigits: 1 })
const roundedFormatter = new Intl.NumberFormat(locales, { maximumFractionDigits: 1 })

const dateFormat = (formatter: Intl.DateTimeFormat, date: DateLike) =>
   formatter.format(date).replace('\u00a0', ' ')

export function asDecimal(number: number, decimalCount = 2): string {
   const options: Intl.NumberFormatOptions = { style: 'decimal', minimumFractionDigits: decimalCount, maximumFractionDigits: decimalCount }
   return new Intl.NumberFormat(locales, options).format(number)
}

// Asset amounts run from fiat totals down to satoshis, so the precision follows the
// magnitude rather than being fixed: 1 234.56 stays readable and 0.00000420 survives.
export function asAssetAmount(number: number): string {
   const magnitude = Math.abs(number)
   if (magnitude >= 1) return asDecimal(number, 2)
   if (magnitude >= 0.01) return asDecimal(number, 4)
   return asDecimal(number, 8)
}

export function asDecimalOne(number: number): string {
   return decimalOneFormatter.format(number)
}

export function asNumber(number: number | null | undefined): string {
   return countFormatter.format(number ?? 0)
}

export function asCompact(number: number): string {
   return compactFormatter.format(number)
}

export function asRounded(number: number): string {
   return roundedFormatter.format(number)
}

export function asShortDate(timestamp: DateLike): string {
   return dateFormat(shortDateFormatter, timestamp)
}

export function asLongDate(timestamp: DateLike): string {
   return dateFormat(longDateFormatter, timestamp)
}

export function asUtcLongDate(timestamp: DateLike): string {
   return dateFormat(utcLongDateFormatter, timestamp)
}

export function asMonthYearDate(timestamp: DateLike): string {
   return dateFormat(monthDateFormatter, timestamp)
}

export function asShortMonthYearDate(timestamp: DateLike): string {
   return dateFormat(shortMonthDateFormatter, timestamp)
}

// Kraken records trade times in UTC; rendering them in the browser's zone would
// silently shift every order.
export function asUtcTimestamp(timestamp: DateLike): string {
   return new Date(timestamp).toISOString().replace('T', ' ').slice(0, 19)
}

export function asLocalTimestamp(timestamp: DateLike): string {
   return dateFormat(localTimestampFormatter, timestamp)
}

export function asPercentage(number: number): string {
   return percentageFormatter.format(number)
}

export function asShortPercentage(number: number): string {
   return shortPercentageFormatter.format(number)
}

export function asDollarAmount(number: number): string {
   return usDollarFormatter.format(number)
}
