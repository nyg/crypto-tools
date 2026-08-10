import { Hono } from 'hono'
import TradeRepository from '../db/trade-repository.js'
import { withAccount } from './with-account.js'

const app = new Hono()

// Orders rather than trades: Kraken's export records one row per fill, and an order
// filled in three goes is still one order. They are grouped on the way out.
app.post('/orders', async (c) => withAccount(c, ({ body, accountId }) =>
   c.json(new TradeRepository(accountId).queryOrders({
      filters: body.filters,
      sort: body.sort,
      page: Math.max(0, Number(body.page) || 0),
      pageSize: Math.min(500, Math.max(1, Number(body.pageSize) || 50))
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
