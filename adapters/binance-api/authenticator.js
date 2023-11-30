import { hmac256 } from '../../utils/crypto'


function RequestPayload({ apiKey, apiSecret }, params) {

   const payload = {
      ...params,
      timestamp: Date.now()
   }

   this.signed = () => ({
      ...payload,
      signature: hmac256(apiSecret, new URLSearchParams(payload).toString())
   })

   this.headers = () => ({
      'X-MBX-APIKEY': apiKey
   })
}

function authenticatorFunction(credentials) {

   return request => {

      const searchParams = new URL(request.url).searchParams
      const payload = new RequestPayload(credentials, searchParams)

      const signedParams = new URLSearchParams(payload.signed()).toString()
      const urlWithParams = `${url}${signedParams ? `?${signedParams}` : ''}`

      const authenticatedRequest = new Request(request)
      authenticatedRequest.url = urlWithParams
      authenticatedRequest.headers = {
         ...authenticatedRequest.headers,
         ...payload.headers()
      }

      return authenticatedRequest
   }
}

export const authenticator = authenticatorFunction
