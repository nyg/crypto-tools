import got from 'got'
import { createHmac } from 'crypto'


function HttpRequester() {

   this.public = async function (url, params = {}) {
      return await got.get(url, {
         searchParams: params
      }).json()
   }

   this.private = async function ({ method = 'GET', url, apiKey, apiSecret }, params = {}) {
      const authPayload = new AuthenticatedPayload(params)
      return await got(url, {
         method,
         searchParams: authPayload.signWith(apiSecret),
         headers: authPayload.buildHeaders(apiKey)
      }).json()
   }
}

function AuthenticatedPayload(params) {

   const payload = {
      ...params,
      timestamp: computeNonce()
   }


   this.signWith = function (secret) {
      return {
         ...payload,
         signature: computeSignature(secret)
      }
   }

   this.buildHeaders = function (apiKey) {
      return { 'X-MBX-APIKEY': apiKey }
   }


   function computeSignature(secret) {
      return createHmac('sha256', secret)
         .update(new URLSearchParams(payload).toString(), 'binary')
         .digest('hex')
   }

   function computeNonce() {
      return Date.now()
   }
}

export const httpRequester = new HttpRequester()
