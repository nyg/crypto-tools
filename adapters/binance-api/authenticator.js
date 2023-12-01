import { hmac256 } from '../../utils/crypto'


function RequestPayload({ apiKey, apiSecret }, params) {

   const payload = {
      ...params,
      timestamp: Date.now()
   }

   this.signed = async () => ({
      ...payload,
      signature: await hmac256(apiSecret, new URLSearchParams(payload).toString())
   })

   this.headers = () => ({
      'X-MBX-APIKEY': apiKey
   })
}

function authenticatorFunction(credentials) {

   return async request => {

      const url = new URL(request.url)
      console.log('original', url)
      const payload = new RequestPayload(credentials, url.searchParams)

      const signedParams = new URLSearchParams(await payload.signed()).toString()
      const urlWithParams = `${url.href}${signedParams ? `?${signedParams}` : ''}`
      console.log('new url', urlWithParams)

      console.log('headers', {...request.headers, ...payload.headers()})

      const authenticatedRequest = new Request(urlWithParams, {
         method: request.method,
         headers: {...request.headers, ...payload.headers()},
         body: request.body
      })

      console.log('auth req', authenticatedRequest)

      return authenticatedRequest
   }
}

export const authenticator = authenticatorFunction
