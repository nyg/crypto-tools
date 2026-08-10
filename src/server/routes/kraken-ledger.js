import { Hono } from 'hono'
import LedgerRepository from '../db/ledger-repository.js'
import TradeRepository from '../db/trade-repository.js'
import tradeRoutes from './kraken-trades.js'
import { withAccount, withCredentials } from './with-account.js'
import { dbSizeBytes } from '../db/paths.js'
import { jobFor, isRunning, requestCancel, startSync } from '../services/kraken-ledger-sync.js'

const app = new Hono()

// Nested under the ledger rather than alongside it: one database, one sync, one
// clear — and the page's post-sync revalidation matches on this prefix.
app.route('/trades', tradeRoutes)

app.post('/sync', async (c) => withCredentials(c, 'kraken', ({ body, credentials, accountId }) =>
   c.json(startSync(accountId, credentials, body.mode === 'full' ? 'full' : 'incremental'))))

app.get('/sync/status', async (c) => withAccount(c, ({ accountId }) => {

   const repository = new LedgerRepository(accountId)
   const tradeRepository = new TradeRepository(accountId)
   const state = repository.readSyncState()

   return c.json({
      job: jobFor(accountId),
      state: {
         ...state,
         accountId,
         entryCount: repository.countEntries(),
         tradeCount: tradeRepository.countTrades(),
         orderCount: tradeRepository.countOrders(),
         dbSizeBytes: dbSizeBytes(),
         otherAccounts: repository.otherAccounts()
      }
   })
}))

app.post('/sync/cancel', async (c) => withAccount(c, ({ accountId }) =>
   c.json({ job: requestCancel(accountId) })))

app.post('/entries', async (c) => withAccount(c, ({ body, accountId }) =>
   c.json(new LedgerRepository(accountId).queryEntries({
      filters: body.filters,
      sort: body.sort,
      page: Math.max(0, Number(body.page) || 0),
      pageSize: Math.min(500, Math.max(1, Number(body.pageSize) || 50))
   }))))

app.get('/filters', async (c) => withAccount(c, ({ accountId }) =>
   c.json(new LedgerRepository(accountId).distinctFilters())))

app.post('/fees', async (c) => withAccount(c, ({ body, accountId }) =>
   c.json(new LedgerRepository(accountId).feeSummary(body.filters))))

app.get('/rewards', async (c) => withAccount(c, ({ accountId }) =>
   c.json(new LedgerRepository(accountId).rewardSummary())))

app.get('/balances', async (c) => withAccount(c, ({ accountId }) =>
   c.json(new LedgerRepository(accountId).balanceSummary())))

app.post('/clear', async (c) => withAccount(c, ({ accountId }) => {

   if (isRunning(jobFor(accountId))) {
      return c.json({ error: 'A sync is running, cancel it before clearing the data.' }, 409)
   }

   return c.json(new LedgerRepository(accountId).clearAccount())
}))

export default app
