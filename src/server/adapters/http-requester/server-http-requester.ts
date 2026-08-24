import { HttpRequesterError } from '../../errors'
import type { AuthenticatedRequest, Authenticator } from '../../../types/credentials'

export type ResponseType = 'json' | 'binary'

export interface RequestOptions {
   method?: string
   searchParams?: Record<string, unknown>
   bodyParams?: unknown
   responseType?: ResponseType
}

interface ExecuteOptions extends RequestOptions {
   authenticate?: Authenticator
}

const identityFunction: Authenticator = async request => request

class ServerHttpRequester {

   async public<T>(url: string, searchParams: Record<string, unknown> = {}): Promise<T> {
      return await this.#execute<T>(url, { searchParams })
   }

   async private<T>(url: string, authenticate: Authenticator, options: RequestOptions = {}): Promise<T> {
      return await this.#execute<T>(url, { ...options, authenticate })
   }

   async #execute<T>(url: string, {
      method = 'GET',
      searchParams = {},
      bodyParams = {},
      authenticate = identityFunction,
      responseType = 'json'
   }: ExecuteOptions): Promise<T> {

      console.log('Fetching:', url, searchParams, bodyParams)
      try {
         const requestData = await authenticate({ url, searchParams, bodyParams })
         const fetchResponse = await fetch(this.#urlWithSearchParams(requestData), {
            method,
            headers: requestData.headers,
            body: method === 'GET' ? undefined : requestData.bodyParams as BodyInit,
         })

         if (!fetchResponse.ok) {
            throw new HttpRequesterError(fetchResponse.status, await fetchResponse.text())
         }

         // Kraken's RetrieveExport answers with a zip on success but with JSON on
         // error, so the payload type has to be sniffed rather than assumed.
         if (responseType === 'binary' && !this.#isJson(fetchResponse)) {
            return new Uint8Array(await fetchResponse.arrayBuffer()) as T
         }

         const response = await fetchResponse.json() as T & { error?: unknown[] }

         // TODO This is special error handling for Kraken API
         if (response?.error?.length) {
            throw new HttpRequesterError(200, response.error)
         }

         if (responseType === 'binary') {
            throw new HttpRequesterError(200, 'Expected a binary payload, received JSON.')
         }

         return response
      }
      catch (error) {
         if (error instanceof HttpRequesterError) {
            console.error('Response error:', error.statusCode, error.body)
            throw error
         }

         console.error('Response error:', error)
         throw new Error('HTTP Requester Error', { cause: JSON.stringify(error) })
      }
   }

   #isJson(fetchResponse: Response): boolean {
      return (fetchResponse.headers.get('content-type') ?? '').includes('json')
   }

   #urlWithSearchParams({ url, searchParams }: AuthenticatedRequest): string {
      const searchParamsString = new URLSearchParams(searchParams as Record<string, string>).toString()
      return `${url}${searchParamsString ? `?${searchParamsString}` : ''}`
   }
}

export const httpRequester = new ServerHttpRequester()
