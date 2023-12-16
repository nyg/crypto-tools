import { httpRequester } from '../http-requester/server-http-requester'
import { authenticator } from './authenticator'

const apiUrl = 'https://api.kraken.com'
const urlFor = endpoint => apiUrl + endpoint

const assetInfoEndpoint = '/0/public/Assets'
const assetPairsEndpoint = '/0/public/AssetPairs'

const balanceExtendedEndpoint = '/0/private/BalanceEx'
const addOrderBatch = '/0/private/AddOrderBatch'


/* Public endpoints */

export async function fetchAssetInfo() {
   return await httpRequester.public(urlFor(assetInfoEndpoint))
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
               // TODO interesting options:
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
