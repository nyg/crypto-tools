import { createHmac } from 'crypto'


function RequestPayload({ apiKey, apiSecret }, params) {

   const payload = {
      ...params,
      timestamp: Date.now()
   }

   this.signed = async () => ({
      ...payload,
      signature: createHmac('sha256', apiSecret)
         .update(new URLSearchParams(payload).toString(), 'binary')
         .digest('hex')
   })

   this.headers = () => ({
      'X-MBX-APIKEY': apiKey
   })
}

function authenticatorFunction(credentials) {

   return async ({ url, searchParams, headers }) => {
      const payload = new RequestPayload(credentials, searchParams)
      return {
         url,
         searchParams: await payload.signed(),
         headers: { ...headers, ...payload.headers() }
      }
   }
}

export const authenticator = authenticatorFunction
