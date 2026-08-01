import { accountIdFor } from '../db/entry-key.js'

export function handleError(c, error) {
   if (error.message === 'HTTP Requester Error') {
      console.log('An error happened while contacting the Kraken API:', error.cause)
      return c.json({ error: `An error happened while contacting the Kraken API: ${error.cause}` }, 500)
   }
   console.error('An unexpected error happened:', error)
   return c.json({ error: 'An unexpected error happened.' }, 500)
}

// Read endpoints never call Kraken; they only need the key to work out which
// account's rows to read, which keeps the secret out of the SWR cache keys.
export async function withAccount(c, handler) {

   const body = await c.req.json()
   if (!body.credentials?.apiKey) return c.json({ error: 'No API credentials provided.' }, 401)

   try {
      return handler({ body, accountId: accountIdFor(body.credentials.apiKey) })
   }
   catch (error) {
      return handleError(c, error)
   }
}
