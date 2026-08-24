export const isMockMode = import.meta.env.VITE_MOCK_DATA === 'true'
// In Electrobun production, the page loads from views:// so relative /api paths won't reach
// the Hono server. The main process picks a free port at startup and injects it through
// the preload, so several Electrobun apps can run at once.
export const API_BASE = window.__API_PORT__
   ? `http://127.0.0.1:${window.__API_PORT__}`
   : import.meta.env.VITE_API_BASE ?? ''

// SWR hands the fetcher its key, and useSWRMutation adds the trigger's argument
// under { arg }. An array key is how a useSWR call — which never gets an arg — can
// still send a request body.
type FetcherKey = string | [string, unknown]
type FetcherParams = { arg?: unknown }

export async function fetcher(key: FetcherKey, params?: FetcherParams): Promise<unknown> {

   // SWR hands the whole key to the fetcher: a plain string, or the array itself for
   // array keys. useSWRMutation passes the body separately as { arg }. An array key
   // is how a useSWR call (which has no arg) can still POST a request body.
   const url = Array.isArray(key) ? key[0] : key
   const body = Array.isArray(key) ? key[1] : params?.arg

   // A mutation is a POST even when it carries no body — triggering one with no
   // argument still means "do this", not "read this".
   const isMutation = params !== undefined && 'arg' in params

   if (isMockMode) {
      const { mockFetcher } = await import('../mocks')
      return mockFetcher(url, isMutation || body ? { arg: body } : undefined)
   }

   let response
   if (isMutation || body) {
      response = await fetch(API_BASE + url, {
         method: 'POST',
         body: JSON.stringify(body ?? {}),
         headers: { 'Content-Type': 'application/json' }
      })
   }
   else {
      response = await fetch(API_BASE + url)
   }

   const result = await response.json()
   if (!response.ok) {
      const error = result?.error || 'An unexpected error happened.'
      return Promise.reject(error)
   }

   return result
}
