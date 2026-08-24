import { Hono } from 'hono'
import TradeRepository from '../db/trade-repository'
import { withAccount } from './with-account'
import type { RequestBody } from './with-account'
import type { AggregationFilters, Sort, TradeFilters } from '../../types/kraken'

const aggregationFiltersOf = (body: RequestBody) => body.filters as AggregationFilters | undefined
const tradeFiltersOf = (body: RequestBody) => body.filters as TradeFilters | undefined
const sortOf = (body: RequestBody) => body.sort as Sort | undefined

const app = new Hono()

// Runs of buying and selling for one base asset, each fold of consecutive same-side
// orders returned as a single row with the orders behind it attached.
app.post('/aggregations', async (c) => withAccount(c, ({ body, accountId }) =>
   c.json(new TradeRepository(accountId).queryAggregations({
      filters: aggregationFiltersOf(body),
      page: Math.max(0, Number(body.page) || 0),
      pageSize: Math.min(500, Math.max(1, Number(body.pageSize) || 20))
   }))))

// The stored trades, ungrouped — what the Ledger page's Trades tab browses, next to
// the ledger entries the same sync wrote.
app.post('/', async (c) => withAccount(c, ({ body, accountId }) =>
   c.json(new TradeRepository(accountId).queryTrades({
      filters: tradeFiltersOf(body),
      sort: sortOf(body),
      page: Math.max(0, Number(body.page) || 0),
      pageSize: Math.min(500, Math.max(1, Number(body.pageSize) || 50))
   }))))

app.get('/filters', async (c) => withAccount(c, ({ accountId }) =>
   c.json(new TradeRepository(accountId).distinctOrderFilters())))

export default app
