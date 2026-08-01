function ServerHttpRequester() {

   const identityFunction = async e => e

   this.public = async function (url, searchParams = {}) {
      return await execute(url, { searchParams })
   }

   this.private = async function (url, authenticate, { method = 'GET', searchParams = {}, bodyParams = {}, responseType = 'json' }) {
      return await execute(url, { method, searchParams, bodyParams, authenticate, responseType })
   }

   async function execute(url, { method = 'GET', searchParams = {}, bodyParams = {}, authenticate = identityFunction, responseType = 'json' }) {

      console.log('Fetching:', url, searchParams, bodyParams)
      try {
         const requestData = await authenticate({ url, searchParams, bodyParams })
         const fetchResponse = await fetch(urlWithSearchParams(requestData), {
            method,
            headers: requestData.headers,
            body: method === 'GET' ? undefined : requestData.bodyParams,
         })

         if (!fetchResponse.ok) {
            const body = await fetchResponse.text()
            const error = new Error()
            error.response = { statusCode: fetchResponse.status, body }
            throw error
         }

         // Kraken's RetrieveExport answers with a zip on success but with JSON on
         // error, so the payload type has to be sniffed rather than assumed.
         if (responseType === 'binary' && !isJson(fetchResponse)) {
            return new Uint8Array(await fetchResponse.arrayBuffer())
         }

         const response = await fetchResponse.json()

         // TODO This is special error handling for Kraken API
         if (response?.error?.length) {
            const error = new Error()
            error.response = { statusCode: 200, body: response.error }
            throw error
         }

         if (responseType === 'binary') {
            const error = new Error()
            error.response = { statusCode: 200, body: 'Expected a binary payload, received JSON.' }
            throw error
         }

         return response
      }
      catch (error) {
         if (error.response) {
            console.error('Response error:', error.response.statusCode, error.response.body)
            throw new Error('HTTP Requester Error', { cause: JSON.stringify(error.response.body) })
         }
         else {
            console.error('Response error:', error)
            throw new Error('HTTP Requester Error', { cause: JSON.stringify(error) })
         }
      }
   }

   function isJson(fetchResponse) {
      return (fetchResponse.headers.get('content-type') ?? '').includes('json')
   }

   function urlWithSearchParams({ url, searchParams }) {
      const searchParamsString = new URLSearchParams(searchParams).toString()
      return `${url}${searchParamsString ? `?${searchParamsString}` : ''}`
   }
}

export const httpRequester = new ServerHttpRequester()
