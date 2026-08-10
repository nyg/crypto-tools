import { credentialsFor, krakenAccountId } from '../settings.js'

export function handleError(c, error) {
   if (error.message === 'HTTP Requester Error') {
      console.log('An error happened while contacting the Kraken API:', error.cause)
      return c.json({ error: `An error happened while contacting the Kraken API: ${error.cause}` }, 500)
   }
   console.error('An unexpected error happened:', error)
   return c.json({ error: 'An unexpected error happened.' }, 500)
}

const noCredentials = c => c.json({ error: 'No API credentials configured.' }, 401)

const readBody = async c =>
   c.req.method === 'GET' ? {} : await c.req.json().catch(() => ({}))

// Read endpoints never call Kraken; they only need to know which account's rows to
// read, and the stored settings answer that without the request carrying anything.
export async function withAccount(c, handler) {

   const accountId = krakenAccountId()
   if (!accountId) return noCredentials(c)

   try {
      return handler({ body: await readBody(c), accountId })
   }
   catch (error) {
      return handleError(c, error)
   }
}

export async function withCredentials(c, provider, handler, { secret = true } = {}) {

   const credentials = credentialsFor(provider)
   if (!credentials.apiKey || (secret && !credentials.apiSecret)) return noCredentials(c)

   try {
      return await handler({ body: await readBody(c), credentials, accountId: krakenAccountId() })
   }
   catch (error) {
      return handleError(c, error)
   }
}
