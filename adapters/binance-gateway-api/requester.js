import got from 'got'


export default function BinanceGatewayRequester() {

   this.execute = async function (url, params = {}) {
      return await got.get(url, {
         searchParams: params
      }).json()
   }
}
