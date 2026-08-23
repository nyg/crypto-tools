import type { Context } from 'hono'
import { credentialsFor, krakenAccountId } from '../settings'
import { HttpRequesterError } from '../errors'
import type { Credentials, Provider } from '../../types/credentials'

// A route body is whatever the browser posted; each handler picks the fields it knows.
export type RequestBody = Record<string, unknown>

export interface HandlerContext {
   body: RequestBody
   accountId: string
}

export interface CredentialledContext extends HandlerContext {
   credentials: Credentials
}

export function handleError(c: Context, error: unknown): Response {
   if (error instanceof HttpRequesterError) {
      console.log('An error happened while contacting the Kraken API:', error.cause)
      return c.json({ error: `An error happened while contacting the Kraken API: ${error.cause}` }, 500)
   }
   console.error('An unexpected error happened:', error)
   return c.json({ error: 'An unexpected error happened.' }, 500)
}

const noCredentials = (c: Context) => c.json({ error: 'No API credentials configured.' }, 401)

const readBody = async (c: Context): Promise<RequestBody> =>
   c.req.method === 'GET' ? {} : await c.req.json<RequestBody>().catch(() => ({}))

// Read endpoints never call Kraken; they only need to know which account's rows to
// read, and the stored settings answer that without the request carrying anything.
export async function withAccount(
   c: Context, handler: (context: HandlerContext) => Response | Promise<Response>
): Promise<Response> {

   const accountId = krakenAccountId()
   if (!accountId) return noCredentials(c)

   try {
      return await handler({ body: await readBody(c), accountId })
   }
   catch (error) {
      return handleError(c, error)
   }
}

export async function withCredentials(
   c: Context, provider: Provider,
   handler: (context: CredentialledContext) => Response | Promise<Response>,
   { secret = true }: { secret?: boolean } = {}
): Promise<Response> {

   const credentials = credentialsFor(provider)
   if (!credentials.apiKey || (secret && !credentials.apiSecret)) return noCredentials(c)

   try {
      return await handler({ body: await readBody(c), credentials, accountId: krakenAccountId() })
   }
   catch (error) {
      return handleError(c, error)
   }
}
