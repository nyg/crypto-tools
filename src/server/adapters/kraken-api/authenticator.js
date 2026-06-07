import { createHash, createHmac } from 'crypto'
import { stringify } from 'qs'


function RequestPayload({ apiKey, apiSecret }, params, path) {

   this.payload = {
      nonce: Date.now(),
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
