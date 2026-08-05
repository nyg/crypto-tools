import { asNumber } from '../../../utils/format'

// Radix Select cannot hold an empty string as a value, so "no filter" travels as
// this sentinel and is mapped back on the way out.
export const ANY = 'any'

export const withAnyOption = (values, label) => [
   { value: ANY, label },
   ...values.map(value => ({ value, label: value }))
]

export const asDateInput = (timestamp) => timestamp
   ? new Date(timestamp).toISOString().slice(0, 10)
   : ''

// The pickers hand back a plain date, which has to be read as UTC to line up with
// the timestamps Kraken records — parsing it as local time would shift the boundary
// by the browser's offset and drop or add a day's rows.
export const fromDateValue = (value) => value ? Date.parse(`${value}T00:00:00Z`) : null
export const toDateValue = (value) => value ? Date.parse(`${value}T23:59:59Z`) : null

// The plural is spelled out only for the nouns an s cannot make, such as entries.
export const asCount = (count, noun, plural) =>
   `${asNumber(count)} ${count === 1 ? noun : plural ?? `${noun}s`}`
