import { httpRequester } from '../http-requester/server-http-requester'
import { authenticator } from './authenticator'

const apiUrl = 'https://api.kraken.com'
const assetInfoEndpoint = '/0/public/Assets'
const balanceExtendedEndpoint = '/0/private/BalanceEx'
const addOrderBatch = '/0/private/AddOrderBatch'

const urlFor = endpoint => apiUrl + endpoint


/* Public endpoints */

export async function fetchAssetInfo() {
   return await httpRequester.public(urlFor(assetInfoEndpoint))
}

/* Private endpoints */

export async function fetchExtendedBalance(apiCredentials) {
   return await httpRequester.private(
      urlFor(balanceExtendedEndpoint),
      authenticator(apiCredentials),
      { method: 'POST' })
}

export async function createOrderBatch(apiCredentials, { pair, direction, dryRun, orders }) {
   return await httpRequester.private(
      urlFor(addOrderBatch),
      authenticator(apiCredentials),
      {
         method: 'POST',
         bodyParams: {
            pair,
            validate: dryRun,
            orders: orders.map(({ volume, price }) => ({
               // interesting options:
               //   userref, displayvol, startm, expiretm
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
