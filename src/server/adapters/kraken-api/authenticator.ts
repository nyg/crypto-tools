import { createHash, createHmac } from 'crypto'
import { stringify } from 'qs'
import type { AuthenticatedRequest, Authenticator, Credentials } from '../../../types/credentials'


// Kraken requires strictly increasing nonces per API key. Date.now() on its own
// collides whenever two private calls land in the same millisecond, which the
// ledger sync's status polling makes routine.
let lastNonce = 0

function nextNonce(): number {
   lastNonce = Math.max(Date.now(), lastNonce + 1)
   return lastNonce
}

class RequestPayload {

   readonly payload: Record<string, unknown>
   readonly #apiKey: string
   readonly #apiSecret: string
   readonly #path: string

   constructor({ apiKey, apiSecret }: Credentials, params: unknown, path: string) {
      this.#apiKey = apiKey
      this.#apiSecret = apiSecret
      this.#path = path
      this.payload = {
         nonce: nextNonce(),
         ...(params as Record<string, unknown>)
      }
   }

   headers(): Record<string, string> {
      return {
         'API-Key': this.#apiKey,
         'API-Sign': this.buildSignature(),
         'Content-Type': 'application/x-www-form-urlencoded'
      }
   }

   buildSignature(): string {
      const message = String(this.payload.nonce) + this.stringifiedPayload()
      const hash = createHash('sha256').update(message).digest('binary')
      return createHmac('sha512', new Uint8Array(Buffer.from(this.#apiSecret, 'base64')))
         .update(this.#path + hash, 'binary')
         .digest('base64')
   }

   stringifiedPayload(): string {
      return stringify(this.payload, { encodeValuesOnly: true })
   }
}

function authenticatorFunction(credentials: Credentials): Authenticator {

   return async ({ url, bodyParams, headers }: AuthenticatedRequest) => {
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
