import got from 'got'


function HttpRequester() {

   this.execute = async function (url, searchParams = {}) {
      console.debug(`URL: ${url}`)
      return await got.get(url, { searchParams }).json()
   }
}

export const httpRequester = new HttpRequester()
