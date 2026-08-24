import { createHash } from 'crypto'
import type { LedgerEntry } from '../../types/kraken'

// A partition key rather than a credential digest: it keeps the rows of two
// Kraken accounts apart in the same local database, and nothing is ever verified
// against it. A slow key derivation function would add nothing here — the input
// is a high-entropy random API key rather than a guessable password, the
// plaintext already sits beside it in localStorage, and this runs on every
// request. Static analysis tends to read it as password hashing; it isn't.
export function accountIdFor(apiKey: string | undefined): string {
   return createHash('sha256').update(apiKey ?? '').digest('hex').slice(0, 16)
}

// Most ledger rows carry a txid, but not all of them do — and keying on txid alone
// would collapse every blank-txid row onto the same primary key. Rows without one
// get a key derived from the fields that identify them.
export function entryKeyFor({ txid, refid, time, type, asset, wallet, amount }: LedgerEntry): string {
   if (txid) return txid

   const material = [refid, time, type, asset, wallet, amount].join('|')
   return `syn:${createHash('sha256').update(material).digest('hex').slice(0, 24)}`
}
