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
const openOrdersEndpoint = '/0/private/OpenOrders'
const cancelOrderEndpoint = '/0/private/CancelOrder'
const cancelOrderBatchEndpoint = '/0/private/CancelOrderBatch'

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

// Kraken checks that the nonce of each private call arrives in increasing order, and
// the authenticator can only guarantee the order they are *generated* in. Two calls in
// flight at once can reach Kraken the other way round, which it rejects with
// EAPI:Invalid nonce — as it did for every page that asked for balances while a sync
// was polling, or twice at once under React's StrictMode.
//
// So private calls queue behind one another. A slow one (retrieving an export) holds up
// the next, which is the price of never having one rejected outright.
let pending = Promise.resolve()

function inNonceOrder(request) {
   const result = pending.then(request, request)
   // The queue must survive a failed call: chaining on `result` itself would leave
   // every later request rejected by the first error.
   pending = result.then(() => {}, () => {})
   return result
}

const privateRequest = (url, apiCredentials, options = {}) =>
   inNonceOrder(() => httpRequester.private(
      url, authenticator(apiCredentials), { method: 'POST', ...options }))

export async function fetchExtendedBalance(apiCredentials) {
   return await privateRequest(urlFor(balanceExtendedEndpoint), apiCredentials)
}

// What is still on the book. The ledger only ever learns about an order once it has
// filled, so this is the one thing it cannot answer: which of the balance it shows is
// already spoken for.
export async function fetchOpenOrders(apiCredentials) {
   return await privateRequest(urlFor(openOrdersEndpoint), apiCredentials)
}

/* Export report endpoints, used to fetch the full ledger and trade history in one go */

export async function addExport(apiCredentials, { report = 'ledgers', description, fromDate, toDate }) {
   return await privateRequest(
      urlFor(addExportEndpoint),
      apiCredentials,
      {
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
   return await privateRequest(urlFor(exportStatusEndpoint), apiCredentials, { bodyParams: { report } })
}

export async function retrieveExport(apiCredentials, { reportId }) {
   return await privateRequest(
      urlFor(retrieveExportEndpoint), apiCredentials,
      { bodyParams: { id: reportId }, responseType: 'binary' })
}

export async function removeExport(apiCredentials, { reportId, type = 'delete' }) {
   return await privateRequest(
      urlFor(removeExportEndpoint), apiCredentials,
      { bodyParams: { id: reportId, type } })
}

export async function createOrderBatch(apiCredentials, { pair, direction, dryRun, userref, orders }) {
   return await privateRequest(
      urlFor(addOrderBatchEndpoint),
      apiCredentials,
      {
         bodyParams: {
            pair,
            validate: dryRun,
            orders: orders.map(({ volume, price }) => ({
               ordertype: 'limit',
               type: direction,
               volume: Big(volume).toFixed(5),
               price: Big(price).toFixed(1),
               oflags: 'post,fciq',
               ...(userref === undefined || userref === null ? {} : { userref })
            }))
         }
      }
   )
}

export async function cancelOrder(apiCredentials, { txid }) {
   return await privateRequest(urlFor(cancelOrderEndpoint), apiCredentials, { bodyParams: { txid } })
}

export async function cancelOrderBatch(apiCredentials, { txids }) {
   return await privateRequest(
      urlFor(cancelOrderBatchEndpoint), apiCredentials, { bodyParams: { orders: txids } })
}
