import { httpRequester } from '../http-requester/server-http-requester'
import { authenticator } from './authenticator'


function KrakenConnection() {

   const apiUrl = 'https://api.kraken.com'


   /* Public endpoints */

   const assetInfoEndpoint = '/0/public/Assets'

   this.fetchAssetInfo = async function () {
      return await httpRequester.public(urlFor(assetInfoEndpoint))
   }


   /* Private endpoints */

   const extendedBalanceEndpoint = '/0/private/BalanceEx'

   this.fetchExtendedBalance = async function (apiCredentials) {
      return await httpRequester.private(
         urlFor(extendedBalanceEndpoint),
         authenticator(apiCredentials),
         { method: 'POST' })
   }


   /* Private functions */

   function urlFor(endpoint) {
      return apiUrl + endpoint
   }
}

export const krakenConnection = new KrakenConnection()
