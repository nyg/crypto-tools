import got from 'got'


function HttpRequester() {

   this.execute = async function (url, searchParams = {}) {
      console.debug(`URL: ${url}`)
      try {
         return await got.get(url, { searchParams }).json()
      }
      catch (error) {
         console.error(`some error happened: ${url}`)
         throw Error('error dude 3')
      }
   }
}

export const httpRequester = new HttpRequester()
