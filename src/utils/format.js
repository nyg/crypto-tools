// const locales = typeof navigator !== 'undefined' ? navigator.language : 'en-GB'
const locales = 'en-GB'

const shortDateFormatter = new Intl.DateTimeFormat(locales, { month: 'short', day: 'numeric' })
const longDateFormatter = new Intl.DateTimeFormat(locales, { year: 'numeric', month: 'short', day: 'numeric' })
const monthDateFormatter = new Intl.DateTimeFormat(locales, { year: 'numeric', month: 'long' })
const shortMonthDateFormatter = new Intl.DateTimeFormat(locales, { year: '2-digit', month: 'short' })
const percentageFormatter = new Intl.NumberFormat(locales, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const usDollarFormatter = new Intl.NumberFormat(locales, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const decimalOneFormatter = new Intl.NumberFormat(locales, { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 })

const dateFormat = (formatter, date) =>
   formatter.format(date).replace('\u00a0', ' ')

export function asDecimal(number, decimalCount = 2) {
   const options = { style: 'decimal', minimumFractionDigits: decimalCount, maximumFractionDigits: decimalCount }
   return new Intl.NumberFormat(locales, options).format(number)
}

export function asDecimalOne(number) {
   return decimalOneFormatter.format(number)
}

export function asShortDate(timestamp) {
   return dateFormat(shortDateFormatter, timestamp)
}

export function asLongDate(timestamp) {
   return dateFormat(longDateFormatter, timestamp)
}

export function asMonthYearDate(timestamp) {
   return dateFormat(monthDateFormatter, timestamp)
}

export function asShortMonthYearDate(timestamp) {
   return dateFormat(shortMonthDateFormatter, timestamp)
}

export function asPercentage(number) {
   return percentageFormatter.format(number)
}

export function asDollarAmount(number) {
   return usDollarFormatter.format(number)
}
