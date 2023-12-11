function BrowserHttpRequester() {

   const identityFunction = async e => e

   this.public = async function (url, searchParams = {}) {
      return await execute({ url, searchParams })
   }

   this.private = async function ({ url, method = 'GET', searchParams = {}, authenticate }) {
      return await execute({ url, method, searchParams, authenticate })
   }

   async function execute({ url, method = 'GET', searchParams = {}, authenticate = identityFunction }) {

      const requestData = await authenticate({ url, searchParams })

      console.log('Fetching:', url, searchParams)
      const response = await fetch(requestData.url, {
         method,
         headers: requestData.headers,
         body: requestData.bodyParams
      })
      console.log('Response status', response.status)

      return {
         error: response.ok ? undefined : response.status,
         data: await (response.ok ? response.json() : response.text())
      }
   }
}

export const httpRequester = new BrowserHttpRequester()
