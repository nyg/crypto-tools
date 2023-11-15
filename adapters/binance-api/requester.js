import got from 'got'
import { createHmac } from 'crypto'


function HttpRequester() {

   this.public = async function (url, params = {}) {
      console.log(`URL: ${url}`)
      try {
         return await got.get(url, {
            searchParams: params
         }).json()
      }
      catch (error) {
         console.error(`some error happened: ${url}`)
         throw Error('error dude 1')
      }
   }

   this.private = async function ({ method = 'GET', url, apiKey, apiSecret }, params = {}) {
      console.log(`URL: ${url}`)
      try {
         const authPayload = new AuthenticatedPayload(params)
         const response = await got(url, {
            method,
            searchParams: authPayload.signWith(apiSecret),
            headers: authPayload.buildHeaders(apiKey)
         })

         console.log(`Weight: ${response.headers['x-sapi-used-uid-weight-1m']}`)
         return JSON.parse(response.body)
      }
      catch (error) {
            console.error(`some error happened: ${url}`)
            throw Error('error dude 2')
         }
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
