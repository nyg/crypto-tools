import { httpRequester } from '../http-requester/server-http-requester'
import { authenticator } from './authenticator'
import Big from 'big.js'

const apiUrl = 'https://api.kraken.com'
const urlFor = endpoint => apiUrl + endpoint

const assetPairsEndpoint = '/0/public/AssetPairs'
const assetInfoEndpoint = '/0/public/Assets'
const tickerEndpoint = '/0/public/Ticker'

const addOrderBatchEndpoint = '/0/private/AddOrderBatch'
const balanceExtendedEndpoint = '/0/private/BalanceEx'

const addExportEndpoint = '/0/private/AddExport'
const exportStatusEndpoint = '/0/private/ExportStatus'
const retrieveExportEndpoint = '/0/private/RetrieveExport'
const removeExportEndpoint = '/0/private/RemoveExport'

/* Public endpoints */

export async function fetchAssetInfo(type = 'currency') {
   return await httpRequester.public(urlFor(assetInfoEndpoint), { aclass: type })
}

export async function fetchAssetPairs(type = 'currency') {
   return await httpRequester.public(urlFor(assetPairsEndpoint), { aclass_base: type })
}

// Every pair, not just the currency ones, because a trade may have been made in a
// class the caller isn't filtering for — a tokenized asset, say — and its assets
// still have to resolve.
export async function fetchAllAssetPairs() {
   return await httpRequester.public(urlFor(assetPairsEndpoint), {})
}

// Kraken takes the pairs as one comma-separated list and answers with a result keyed
// by its own name for each of them, which is not always the name that was asked for.
export async function fetchTicker(pairs) {
   return await httpRequester.public(urlFor(tickerEndpoint), { pair: pairs.join(',') })
}

/* Private endpoints */

export async function fetchExtendedBalance(apiCredentials) {
   return await httpRequester.private(
      urlFor(balanceExtendedEndpoint),
      authenticator(apiCredentials),
      { method: 'POST' })
}

/* Export report endpoints, used to fetch the full ledger and trade history in one go */

export async function addExport(apiCredentials, { report = 'ledgers', description, fromDate, toDate }) {
   return await httpRequester.private(
      urlFor(addExportEndpoint),
      authenticator(apiCredentials),
      {
         method: 'POST',
         bodyParams: {
            report,
            format: 'CSV',
            fields: 'all',
            description,
            // Kraken expects seconds here, not milliseconds.
            starttm: Math.floor(fromDate / 1000),
            // endtm is deliberately left out so that Kraken decides where "now" is.
            ...(toDate ? { endtm: Math.floor(toDate / 1000) } : {})
         }
      }
   )
}

// Kraken lists reports of one type per call, so this has to be asked the same type
// that was exported — a ledgers-only listing never contains the trades report, and
// waiting for it there would simply time out.
export async function fetchExportStatus(apiCredentials, report = 'ledgers') {
   return await httpRequester.private(
      urlFor(exportStatusEndpoint),
      authenticator(apiCredentials),
      { method: 'POST', bodyParams: { report } })
}

export async function retrieveExport(apiCredentials, { reportId }) {
   return await httpRequester.private(
      urlFor(retrieveExportEndpoint),
      authenticator(apiCredentials),
      { method: 'POST', bodyParams: { id: reportId }, responseType: 'binary' })
}

export async function removeExport(apiCredentials, { reportId, type = 'delete' }) {
   return await httpRequester.private(
      urlFor(removeExportEndpoint),
      authenticator(apiCredentials),
      { method: 'POST', bodyParams: { id: reportId, type } })
}

export async function createOrderBatch(apiCredentials, { pair, direction, dryRun, orders }) {
   return await httpRequester.private(
      urlFor(addOrderBatchEndpoint),
      authenticator(apiCredentials),
      {
         method: 'POST',
         bodyParams: {
            pair,
            validate: dryRun,
            orders: orders.map(({ volume, price }) => ({
               ordertype: 'limit',
               type: direction,
               volume: Big(volume).toFixed(5),
               price: Big(price).toFixed(1),
               oflags: 'post,fciq'
            }))
         }
      }
   )
}
