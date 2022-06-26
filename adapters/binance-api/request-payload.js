import { createHmac } from 'crypto'


export default function BinanceRequestPayload(params) {

   const payload = {
      ...params,
      timestamp: computeNonce()
   }


   this.signWith = function (secret) {
      return {
         ...payload,
         signature: computeSignature(secret)
      }
   }


   function computeSignature(secret) {
      return createHmac('sha256', secret)
         .update(new URLSearchParams(payload).toString(), 'binary')
         .digest('hex')
   }

   function computeNonce() {
      return Date.now()
   }
}
