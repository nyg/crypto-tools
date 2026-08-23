// One data row of an export, keyed by lowercased header name.
export type CsvRow = Record<string, string>

// Minimal RFC 4180 reader. Kraken's ledger export is well-behaved, but quoted
// fields do appear, so quotes and embedded separators are handled.
function parseRows(text: string): string[][] {

   const rows: string[][] = []
   let row: string[] = []
   let field = ''
   let quoted = false
   let hasField = false

   const endField = () => {
      row.push(field)
      field = ''
      hasField = false
   }

   const endRow = () => {
      endField()
      // Skip blank lines rather than emitting a one-empty-field row.
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
   }

   for (let i = 0; i < text.length; i++) {
      const char = text[i]

      if (quoted) {
         if (char !== '"') {
            field += char
         }
         else if (text[i + 1] === '"') {
            field += '"'
            i++
         }
         else {
            quoted = false
         }
      }
      else if (char === '"' && !hasField) {
         quoted = true
         hasField = true
      }
      else if (char === ',') {
         endField()
      }
      else if (char === '\n') {
         endRow()
      }
      else if (char !== '\r') {
         field += char
         hasField = true
      }
   }

   if (field !== '' || row.length > 0) endRow()
   return rows
}

// Returns one object per data row, keyed by header name. Kraken has added columns
// to this export over time (subclass, wallet), so nothing may depend on the column
// order or on how many there are.
export function parseCsv(text: string): CsvRow[] {

   const rows = parseRows(text)
   if (rows.length === 0) return []

   const headers = rows[0].map(header => header.trim().toLowerCase())

   return rows.slice(1).map(row =>
      headers.reduce<CsvRow>((entry, header, index) => {
         entry[header] = (row[index] ?? '').trim()
         return entry
      }, {}))
}

// The export writes "2023-01-15 14:22:31" with no zone. It is UTC, and passing the
// string straight to new Date() would read it as local time instead.
export function parseCsvTime(value: string | undefined): number {

   const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value ?? '')
   if (!match) return Number.NaN

   const [, year, month, day, hours, minutes, seconds] = match.map(Number)
   return Date.UTC(year, month - 1, day, hours, minutes, seconds)
}
