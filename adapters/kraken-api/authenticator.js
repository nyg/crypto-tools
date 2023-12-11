import { createHash, createHmac } from 'crypto'

function RequestPayload({ apiKey, apiSecret }, params, path) {

   this.payload = {
      ...params,
      nonce: Date.now()
   }

   this.headers = () => ({
      'API-Key': apiKey,
      'API-Sign': buildSignature(this.payload),
      'Content-Type': 'application/x-www-form-urlencoded'
   })

   function buildSignature(payload) {
      const message = payload.nonce + new URLSearchParams(payload)
      const hash = createHash('sha256').update(message).digest('binary')
      return createHmac('sha512', new Buffer(apiSecret, 'base64'))
         .update(path + hash, 'binary')
         .digest('base64')
   }
}

function authenticatorFunction(credentials) {

   return async ({ url, bodyParams, headers }) => {
      const path = new URL(url).pathname
      const payload = new RequestPayload(credentials, bodyParams, path)
      return {
         url,
         bodyParams: payload.payload,
         headers: { ...headers, ...payload.headers() }
      }
   }
}

export const authenticator = authenticatorFunction
