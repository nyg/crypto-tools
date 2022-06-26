import got from 'got'
import BinanceRequestPayload from './request-payload.js'


export default function BinanceRequester(_apiKey, _apiSecret) {

   const apiKey = _apiKey
   const apiSecret = _apiSecret


   // TODO add verb to method name, e.g. execute/request
   this.public = async function (url, params = {}) {
      return await got.get(url, {
         searchParams: params
      }).json()
   }

   this.private = async function (url, params = {}) {
      return await got.get(url, {
         searchParams: buildSignedPayload(params),
         headers: buildAuthHeaders()
      }).json()
   }


   function buildSignedPayload(params) {
      return new BinanceRequestPayload(params).signWith(apiSecret)
   }

   function buildAuthHeaders() {
      return { 'X-MBX-APIKEY': apiKey }
   }
}
