const locales = typeof navigator !== 'undefined' ? navigator.language : 'en-GB'

const decimalFormatter = new Intl.NumberFormat(locales, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const longDateFormatter = new Intl.DateTimeFormat(locales, { year: 'numeric', month: 'short', day: 'numeric' })
const percentageFormatter = new Intl.NumberFormat(locales, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const dateFormat = (formatter, date) =>
  formatter.format(date).replace(' ', ' ') // non-breaking space



export function asDecimal(number) {
  return decimalFormatter.format(number)
}

export function asLongDate(timestamp) {
  return dateFormat(longDateFormatter, timestamp)
}

export function asPercentage(number) {
  return percentageFormatter.format(number)
}
