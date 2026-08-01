import { Hono } from 'hono'
import Big from 'big.js'
import LedgerRepository from '../db/ledger-repository.js'
import { accountIdFor } from '../db/entry-key.js'
import { dbSizeBytes } from '../db/paths.js'
import { isStakingReward } from '../adapters/kraken-api/assets.js'
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

app.post('/summary', async (c) => withAccount(c, ({ body, repository }) => {

   const rows = repository.summaryRows(body.filters)

   // Totals are reduced with Big rather than summed in SQL: the amounts are stored
   // as text precisely so that no step of this goes through a float.
   const byAsset = rows.reduce((assets, row) => {
      const asset = assets[row.baseAsset] ??= {
         asset: row.baseAsset, count: 0,
         netAmount: Big(0), feeTotal: Big(0), rewardAmount: Big(0)
      }

      asset.count++
      asset.netAmount = asset.netAmount.plus(row.amount).minus(row.fee)
      asset.feeTotal = asset.feeTotal.plus(row.fee)
      if (isStakingReward(row)) {
         asset.rewardAmount = asset.rewardAmount.plus(row.amount).minus(row.fee)
      }

      return assets
   }, {})

   const balances = repository.latestBalances().reduce((balances, row) => {
      balances[row.baseAsset] = (balances[row.baseAsset] ?? Big(0)).plus(row.balance || 0)
      return balances
   }, {})

   const types = rows.reduce((types, row) => {
      types[row.type] = (types[row.type] ?? 0) + 1
      return types
   }, {})

   const assets = Object.values(byAsset)
      .map(asset => ({
         asset: asset.asset,
         count: asset.count,
         netAmount: asset.netAmount.toFixed(),
         feeTotal: asset.feeTotal.toFixed(),
         rewardAmount: asset.rewardAmount.toFixed(),
         balance: balances[asset.asset]?.toFixed() ?? null
      }))
      .toSorted((a, b) => b.count - a.count)

   const { first, last } = repository.entryTimeRange()

   return c.json({
      totals: { entryCount: rows.length, assetCount: assets.length, from: first, to: last },
      assets,
      types: Object.entries(types)
         .map(([type, count]) => ({ type, count }))
         .toSorted((a, b) => b.count - a.count)
   })
}))

app.post('/clear', async (c) => withAccount(c, ({ accountId, repository }) => {

   if (isRunning(jobFor(accountId))) {
      return c.json({ error: 'A sync is running, cancel it before clearing the data.' }, 409)
   }

   return c.json({ deleted: repository.clearAccount() })
}))

export default app
