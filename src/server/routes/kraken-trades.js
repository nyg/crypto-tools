import { Hono } from 'hono'
import TradeRepository from '../db/trade-repository.js'
import { withAccount } from './with-account.js'

const app = new Hono()

// Runs of buying and selling for one base asset, each fold of consecutive same-side
// orders returned as a single row with the orders behind it attached.
app.post('/aggregations', async (c) => withAccount(c, ({ body, accountId }) =>
   c.json(new TradeRepository(accountId).queryAggregations({
      filters: body.filters,
      page: Math.max(0, Number(body.page) || 0),
      pageSize: Math.min(500, Math.max(1, Number(body.pageSize) || 20))
   }))))

// The stored fills, ungrouped — what the Ledger page's Trades tab browses, next to
// the ledger entries the same sync wrote.
app.post('/fills', async (c) => withAccount(c, ({ body, accountId }) =>
   c.json(new TradeRepository(accountId).queryTrades({
      filters: body.filters,
      sort: body.sort,
      page: Math.max(0, Number(body.page) || 0),
      pageSize: Math.min(500, Math.max(1, Number(body.pageSize) || 50))
   }))))

app.get('/filters', async (c) => withAccount(c, ({ accountId }) =>
   c.json(new TradeRepository(accountId).distinctOrderFilters())))

export default app
