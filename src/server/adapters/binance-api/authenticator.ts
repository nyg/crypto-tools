import { createHmac } from 'crypto'
import type { AuthenticatedRequest, Authenticator, Credentials } from '../../../types/credentials'


class RequestPayload {

   readonly #apiKey: string
   readonly #apiSecret: string
   readonly #payload: Record<string, unknown>

   constructor({ apiKey, apiSecret }: Credentials, params: Record<string, unknown> | undefined) {
      this.#apiKey = apiKey
      this.#apiSecret = apiSecret
      this.#payload = {
         ...params,
         timestamp: Date.now()
      }
   }

   async signed(): Promise<Record<string, unknown>> {
      return {
         ...this.#payload,
         signature: createHmac('sha256', this.#apiSecret)
            .update(new URLSearchParams(this.#payload as Record<string, string>).toString(), 'binary')
            .digest('hex')
      }
   }

   headers(): Record<string, string> {
      return {
         'X-MBX-APIKEY': this.#apiKey
      }
   }
}

function authenticatorFunction(credentials: Credentials): Authenticator {

   return async ({ url, searchParams, headers }: AuthenticatedRequest) => {
      const payload = new RequestPayload(credentials, searchParams)
      return {
         url,
         searchParams: await payload.signed(),
         headers: { ...headers, ...payload.headers() }
      }
   }
}

export const authenticator = authenticatorFunction
