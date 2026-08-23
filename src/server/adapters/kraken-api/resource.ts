import Big from 'big.js'
import { httpRequester } from '../http-requester/server-http-requester'
import type { RequestOptions } from '../http-requester/server-http-requester'
import { authenticator } from './authenticator'
import type { Credentials } from '../../../types/credentials'
import type { ExportReportType, ExportRequest } from '../../../types/kraken'
import type {
   KrakenAddExportResult, KrakenAddOrderBatchResult, KrakenAssetPairs, KrakenAssets,
   KrakenCancelResult, KrakenExportStatus, KrakenExtendedBalance, KrakenOpenOrders,
   KrakenOrderBatchParams, KrakenResponse, KrakenTicker
} from '../../../types/kraken-api'

const apiUrl = 'https://api.kraken.com'
const urlFor = (endpoint: string) => apiUrl + endpoint

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

export async function fetchAssetInfo(type = 'currency'): Promise<KrakenResponse<KrakenAssets>> {
   return await httpRequester.public(urlFor(assetInfoEndpoint), { aclass: type })
}

export async function fetchAssetPairs(type = 'currency'): Promise<KrakenResponse<KrakenAssetPairs>> {
   return await httpRequester.public(urlFor(assetPairsEndpoint), { aclass_base: type })
}

// Every pair, not just the currency ones, because a trade may have been made in a
// class the caller isn't filtering for — a tokenized asset, say — and its assets
// still have to resolve.
export async function fetchAllAssetPairs(): Promise<KrakenResponse<KrakenAssetPairs>> {
   return await httpRequester.public(urlFor(assetPairsEndpoint), {})
}

// Kraken takes the pairs as one comma-separated list and answers with a result keyed
// by its own name for each of them, which is not always the name that was asked for.
export async function fetchTicker(pairs: string[]): Promise<KrakenResponse<KrakenTicker>> {
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
let pending: Promise<unknown> = Promise.resolve()

function inNonceOrder<T>(request: () => Promise<T>): Promise<T> {
   const result = pending.then(request, request)
   // The queue must survive a failed call: chaining on `result` itself would leave
   // every later request rejected by the first error.
   pending = result.then(() => {}, () => {})
   return result
}

const privateRequest = <T>(url: string, apiCredentials: Credentials, options: RequestOptions = {}) =>
   inNonceOrder(() => httpRequester.private<T>(
      url, authenticator(apiCredentials), { method: 'POST', ...options }))

export async function fetchExtendedBalance(apiCredentials: Credentials): Promise<KrakenResponse<KrakenExtendedBalance>> {
   return await privateRequest(urlFor(balanceExtendedEndpoint), apiCredentials)
}

// What is still on the book. The ledger only ever learns about an order once it has
// filled, so this is the one thing it cannot answer: which of the balance it shows is
// already spoken for.
export async function fetchOpenOrders(apiCredentials: Credentials): Promise<KrakenResponse<KrakenOpenOrders>> {
   return await privateRequest(urlFor(openOrdersEndpoint), apiCredentials)
}

/* Export report endpoints, used to fetch the full ledger and trade history in one go */

export async function addExport(apiCredentials: Credentials, { report = 'ledgers', description, fromDate, toDate }: Partial<ExportRequest>): Promise<KrakenResponse<KrakenAddExportResult>> {
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
            starttm: Math.floor((fromDate ?? 0) / 1000),
            // endtm is deliberately left out so that Kraken decides where "now" is.
            ...(toDate ? { endtm: Math.floor(toDate / 1000) } : {})
         }
      }
   )
}

// Kraken lists reports of one type per call, so this has to be asked the same type
// that was exported — a ledgers-only listing never contains the trades report, and
// waiting for it there would simply time out.
export async function fetchExportStatus(apiCredentials: Credentials, report: ExportReportType = 'ledgers'): Promise<KrakenResponse<KrakenExportStatus>> {
   return await privateRequest(urlFor(exportStatusEndpoint), apiCredentials, { bodyParams: { report } })
}

export async function retrieveExport(apiCredentials: Credentials, { reportId }: { reportId: string }): Promise<Uint8Array> {
   return await privateRequest<Uint8Array>(
      urlFor(retrieveExportEndpoint), apiCredentials,
      { bodyParams: { id: reportId }, responseType: 'binary' })
}

export async function removeExport(apiCredentials: Credentials, { reportId, type = 'delete' }: { reportId: string, type?: string }): Promise<KrakenResponse<unknown>> {
   return await privateRequest(
      urlFor(removeExportEndpoint), apiCredentials,
      { bodyParams: { id: reportId, type } })
}

export async function createOrderBatch(apiCredentials: Credentials, { pair, direction, dryRun, userref, orders }: KrakenOrderBatchParams): Promise<KrakenResponse<KrakenAddOrderBatchResult>> {
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

export async function cancelOrder(apiCredentials: Credentials, { txid }: { txid: string }): Promise<KrakenResponse<KrakenCancelResult>> {
   return await privateRequest(urlFor(cancelOrderEndpoint), apiCredentials, { bodyParams: { txid } })
}

export async function cancelOrderBatch(apiCredentials: Credentials, { txids }: { txids: string[] }): Promise<KrakenResponse<KrakenCancelResult>> {
   return await privateRequest(
      urlFor(cancelOrderBatchEndpoint), apiCredentials, { bodyParams: { orders: txids } })
}
