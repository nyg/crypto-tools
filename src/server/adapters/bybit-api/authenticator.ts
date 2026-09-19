import { createHmac } from 'crypto'
import type { AuthenticatedRequest, Authenticator, Credentials } from '../../../types/credentials'

const RECV_WINDOW = '10000'

const definedParams = (params: Record<string, unknown> = {}): Record<string, string> =>
   Object.fromEntries(Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]))

const signature = (secret: string, message: string) =>
   createHmac('sha256', secret).update(message).digest('hex')

function authenticatorFunction({ apiKey, apiSecret }: Credentials): Authenticator {

   return async ({ url, searchParams, bodyParams, headers }: AuthenticatedRequest) => {

      const timestamp = String(Date.now())
      const query = definedParams(searchParams)
      const hasBody = bodyParams !== undefined && Object.keys(bodyParams as object).length > 0
      const body = hasBody ? JSON.stringify(bodyParams) : ''
      const payload = hasBody ? body : new URLSearchParams(query).toString()

      return {
         url,
         searchParams: query,
         bodyParams: body,
         headers: {
            ...headers,
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': RECV_WINDOW,
            'X-BAPI-SIGN': signature(apiSecret, timestamp + apiKey + RECV_WINDOW + payload)
         }
      }
   }
}

export const authenticator = authenticatorFunction
