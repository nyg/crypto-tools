import { createHash } from 'crypto'

export function accountIdFor(apiKey) {
   return createHash('sha256').update(apiKey ?? '').digest('hex').slice(0, 16)
}

// Most ledger rows carry a txid, but not all of them do — and keying on txid alone
// would collapse every blank-txid row onto the same primary key. Rows without one
// get a key derived from the fields that identify them.
export function entryKeyFor({ txid, refid, time, type, asset, wallet, amount }) {
   if (txid) return txid

   const material = [refid, time, type, asset, wallet, amount].join('|')
   return `syn:${createHash('sha256').update(material).digest('hex').slice(0, 24)}`
}
