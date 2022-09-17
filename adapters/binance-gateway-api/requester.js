import got from 'got'


function HttpRequester() {

   this.execute = async function (url, params = {}) {
      return await got.get(url, {
         searchParams: params
      }).json()
   }
}

export const httpRequester = new HttpRequester()
