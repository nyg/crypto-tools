import { httpRequester } from '../http-requester/server-http-requester'
import { authenticator } from './authenticator'

const apiUrl = 'https://api.kraken.com'
const urlFor = endpoint => apiUrl + endpoint

const assetPairsEndpoint = '/0/public/AssetPairs'
const assetInfoEndpoint = '/0/public/Assets'

const addOrderBatchEndpoint = '/0/private/AddOrderBatch'
const balanceExtendedEndpoint = '/0/private/BalanceEx'
const closedOrdersEndpoint = '/0/private/ClosedOrders'

/* Public endpoints */

export async function fetchAssetInfo(type = 'currency') {
   return await httpRequester.public(urlFor(assetInfoEndpoint), { aclass: type })
}

export async function fetchAssetPairs() {
   return await httpRequester.public(urlFor(assetPairsEndpoint))
}

/* Private endpoints */

export async function fetchExtendedBalance(apiCredentials) {
   return await httpRequester.private(
      urlFor(balanceExtendedEndpoint),
      authenticator(apiCredentials),
      { method: 'POST' })
}

export async function fetchClosedOrders(apiCrendentials, { showTrades, fromDate, toDate, orderOffset }) {
   return await httpRequester.private(
      urlFor(closedOrdersEndpoint),
      authenticator(apiCrendentials),
      {
         method: 'POST',
         bodyParams: {
            trades: showTrades,
            start: fromDate,
            end: toDate,
            ofs: orderOffset
         }
      }
   )
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
               volume: volume,
               price: price,
               oflags: 'post,fciq'
            }))
         }
      }
   )
}
