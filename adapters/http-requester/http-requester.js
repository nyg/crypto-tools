function HttpRequester() {

   this.public = function (url, params = {}) {
      execute({ url, params })
   }

   this.private = function ({ url, method = 'GET', params = {}, authenticate }) {
      execute({ url, method, params, authenticate })
   }

   async function execute({ url, method = 'GET', params = {}, authenticate }) {

      const searchParams = new URLSearchParams(params).toString()
      const urlWithParams = `${url}${searchParams ? `?${searchParams}` : ''}`

      let request = new Request(urlWithParams, { method })
      request = authenticate ? await authenticate(request) : request

      console.log(`Fetching request: ${request}`)
      const response = await fetch(request)
      console.log(`Response status: ${response.status}`)

      return {
         error: response.ok ? undefined : response.status,
         data: await (response.ok ? response.json() : response.text())
      }
   }
}

export const httpRequester = new HttpRequester()
