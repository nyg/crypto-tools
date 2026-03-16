import { useLocale } from '../contexts/locale-context'

export function asDecimal(number, decimalCount = 2, locale = 'en-GB') {
   const options = { style: 'decimal', minimumFractionDigits: decimalCount, maximumFractionDigits: decimalCount }
   return new Intl.NumberFormat(locale, options).format(number)
}

export function asLongDate(timestamp, locale = 'en-GB') {
   return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' })
      .format(timestamp)
      .replace(' ', '\u00A0') // non-breaking space
}

export function asPercentage(number, locale = 'en-GB') {
   return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)
}

export function asDollarAmount(number, locale = 'en-GB') {
   return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)
}

export function useFormat() {
   const locale = useLocale()
   return {
      asDecimal: (number, decimalCount = 2) => asDecimal(number, decimalCount, locale),
      asLongDate: (timestamp) => asLongDate(timestamp, locale),
      asPercentage: (number) => asPercentage(number, locale),
      asDollarAmount: (number) => asDollarAmount(number, locale),
   }
}
