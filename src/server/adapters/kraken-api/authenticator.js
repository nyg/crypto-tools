import { createHash, createHmac } from 'crypto'
import { stringify } from 'qs'


// Kraken requires strictly increasing nonces per API key. Date.now() on its own
// collides whenever two private calls land in the same millisecond, which the
// ledger sync's status polling makes routine.
let lastNonce = 0

function nextNonce() {
   lastNonce = Math.max(Date.now(), lastNonce + 1)
   return lastNonce
}

function RequestPayload({ apiKey, apiSecret }, params, path) {

   this.payload = {
      nonce: nextNonce(),
      ...params
   }

   this.headers = () => ({
      'API-Key': apiKey,
      'API-Sign': this.buildSignature(this.payload),
      'Content-Type': 'application/x-www-form-urlencoded'
   })

   this.buildSignature = () => {
      const message = this.payload.nonce + this.stringifiedPayload()
      const hash = createHash('sha256').update(message).digest('binary')
      return createHmac('sha512', Buffer.from(apiSecret, 'base64'))
         .update(path + hash, 'binary')
         .digest('base64')
   }

   this.stringifiedPayload = () => {
      return stringify(this.payload, { encodeValuesOnly: true })
   }
}

function authenticatorFunction(credentials) {

   return async ({ url, bodyParams, headers }) => {
      const path = new URL(url).pathname
      const payload = new RequestPayload(credentials, bodyParams, path)
      return {
         url,
         bodyParams: payload.stringifiedPayload(),
         headers: { ...headers, ...payload.headers() }
      }
   }
}

export const authenticator = authenticatorFunction
