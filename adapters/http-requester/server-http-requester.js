import got from 'got'


function ServerHttpRequester() {

   const identityFunction = async e => e

   this.public = async function (url, searchParams = {}) {
      return await execute(url, { searchParams })
   }

   this.private = async function (url, authenticate, { method = 'GET', searchParams = {}, bodyParams = {} }) {
      return await execute(url, { method, searchParams, bodyParams, authenticate })
   }

   async function execute(url, { method = 'GET', searchParams = {}, bodyParams = {}, authenticate = identityFunction }) {

      console.log('Fetching:', url, searchParams, bodyParams)
      try {
         const requestData = await authenticate({ url, searchParams, bodyParams })
         const response = await got(urlWithSearchParams(requestData), {
            method,
            headers: requestData.headers,
            body: method === 'GET' ? undefined : requestData.bodyParams,
            responseType: 'json'
         }).json()

         // TODO This is special error handling for Kraken API
         if (response?.error?.length) {
            const error = new Error()
            error.response = { statusCode: 200, body: response.error }
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

   function urlWithSearchParams({ url, searchParams }) {
      const searchParamsString = new URLSearchParams(searchParams).toString()
      return `${url}${searchParamsString ? `?${searchParamsString}` : ''}`
   }
}

export const httpRequester = new ServerHttpRequester()
