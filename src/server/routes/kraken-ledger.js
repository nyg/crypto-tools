import { Hono } from 'hono'
import LedgerRepository from '../db/ledger-repository.js'
import { accountIdFor } from '../db/entry-key.js'
import { dbSizeBytes } from '../db/paths.js'
import { jobFor, isRunning, requestCancel, startSync } from '../services/kraken-ledger-sync.js'

const app = new Hono()

const handleError = (c, error) => {
   if (error.message === 'HTTP Requester Error') {
      console.log('An error happened while contacting the Kraken API:', error.cause)
      return c.json({ error: `An error happened while contacting the Kraken API: ${error.cause}` }, 500)
   }
   console.error('An unexpected error happened:', error)
   return c.json({ error: 'An unexpected error happened.' }, 500)
}

// Read endpoints never call Kraken; they only need the key to work out which
// account's rows to read, which keeps the secret out of the SWR cache keys.
async function withAccount(c, handler) {
   const body = await c.req.json()
   if (!body.credentials?.apiKey) return c.json({ error: 'No API credentials provided.' }, 401)

   try {
      const accountId = accountIdFor(body.credentials.apiKey)
      return handler({ body, accountId, repository: new LedgerRepository(accountId) })
   }
   catch (error) {
      return handleError(c, error)
   }
}

app.post('/sync', async (c) => {

   const { credentials, mode } = await c.req.json()
   if (!credentials?.apiKey || !credentials?.apiSecret) {
      return c.json({ error: 'No API credentials provided.' }, 401)
   }

   try {
      return c.json(startSync(credentials, mode === 'full' ? 'full' : 'incremental'))
   }
   catch (error) {
      return handleError(c, error)
   }
})

app.post('/sync/status', async (c) => withAccount(c, ({ accountId, repository }) => {

   const state = repository.readSyncState()

   return c.json({
      job: jobFor(accountId),
      state: {
         ...state,
         accountId,
         entryCount: repository.countEntries(),
         dbSizeBytes: dbSizeBytes(),
         otherAccounts: repository.otherAccounts()
      }
   })
}))

app.post('/sync/cancel', async (c) => withAccount(c, ({ accountId }) =>
   c.json({ job: requestCancel(accountId) })))

app.post('/entries', async (c) => withAccount(c, ({ body, repository }) =>
   c.json(repository.queryEntries({
      filters: body.filters,
      sort: body.sort,
      page: Math.max(0, Number(body.page) || 0),
      pageSize: Math.min(500, Math.max(1, Number(body.pageSize) || 50))
   }))))

app.post('/filters', async (c) => withAccount(c, ({ repository }) =>
   c.json(repository.distinctFilters())))

app.post('/fees', async (c) => withAccount(c, ({ body, repository }) =>
   c.json(repository.feeSummary(body.filters))))

app.post('/clear', async (c) => withAccount(c, ({ accountId, repository }) => {

   if (isRunning(jobFor(accountId))) {
      return c.json({ error: 'A sync is running, cancel it before clearing the data.' }, 409)
   }

   return c.json({ deleted: repository.clearAccount() })
}))

export default app
