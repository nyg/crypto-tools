import Big from 'big.js'
import { getDatabase } from './database.js'

// Columns the ungrouped fills may be sorted by, mapped to the column that produces
// them. Anything not in here is rejected rather than interpolated into the query.
// The numeric ones read the REAL mirrors: exact decimals live in TEXT columns that
// SQLite would sort lexically ('9' after '10'), so ordering has to use the doubles
// even though the values shown to the user are the exact strings.
const sortableTradeColumns = {
   time: 'time',
   pair: 'pair_key',
   direction: 'type',
   ordertype: 'ordertype',
   volume: 'vol_num',
   price: 'price_num',
   cost: 'cost_num',
   fee: 'fee_num'
}

const FILL_LIMIT = 50000

const upsertStatement = `
   INSERT INTO trade (
      account_id, txid, ordertxid, order_key, pair, pair_key, base_asset, quote_asset,
      time, type, ordertype, price, cost, fee, vol, margin, misc,
      price_num, cost_num, fee_num, vol_num, synced_at)
   VALUES ($accountId, $txid, $ordertxid, $orderKey, $pair, $pairKey, $baseAsset, $quoteAsset,
      $time, $type, $ordertype, $price, $cost, $fee, $vol, $margin, $misc,
      $priceNum, $costNum, $feeNum, $volNum, $syncedAt)
   ON CONFLICT (account_id, txid) DO UPDATE SET
      ordertxid = excluded.ordertxid, order_key = excluded.order_key,
      pair = excluded.pair, pair_key = excluded.pair_key,
      base_asset = excluded.base_asset, quote_asset = excluded.quote_asset,
      time = excluded.time, type = excluded.type, ordertype = excluded.ordertype,
      price = excluded.price, cost = excluded.cost, fee = excluded.fee, vol = excluded.vol,
      margin = excluded.margin, misc = excluded.misc,
      price_num = excluded.price_num, cost_num = excluded.cost_num,
      fee_num = excluded.fee_num, vol_num = excluded.vol_num,
      synced_at = excluded.synced_at`

export default function TradeRepository(accountId) {

   const db = getDatabase()

   // Every statement below is scoped by account_id, like the ledger's, so two Kraken
   // accounts stored side by side can never read or overwrite each other's trades.

   this.upsertTrades = function (trades, syncedAt) {

      const insert = db.prepare(upsertStatement)

      db.transaction(() => {
         for (const trade of trades) {
            insert.run({
               $accountId: accountId,
               $txid: trade.txid,
               $ordertxid: trade.ordertxid,
               $orderKey: trade.orderKey,
               $pair: trade.pair,
               $pairKey: trade.pairKey,
               $baseAsset: trade.baseAsset,
               $quoteAsset: trade.quoteAsset,
               $time: trade.time,
               $type: trade.type,
               $ordertype: trade.ordertype,
               $price: trade.price,
               $cost: trade.cost,
               $fee: trade.fee,
               $vol: trade.vol,
               $margin: trade.margin,
               $misc: trade.misc,
               $priceNum: Number(trade.price),
               $costNum: Number(trade.cost),
               $feeNum: Number(trade.fee),
               $volNum: Number(trade.vol),
               $syncedAt: syncedAt
            })
         }
      })()
   }

   this.countTrades = function () {
      return db.query('SELECT COUNT(*) AS count FROM trade WHERE account_id = ?')
         .get(accountId).count
   }

   this.countOrders = function () {
      return db.query('SELECT COUNT(DISTINCT order_key) AS count FROM trade WHERE account_id = ?')
         .get(accountId).count
   }

   this.tradeTimeRange = function () {
      const range = db.query(`
         SELECT MIN(time) AS first, MAX(time) AS last
         FROM trade WHERE account_id = ?`).get(accountId)
      return { first: range.first ?? null, last: range.last ?? null }
   }

   this.queryAggregations = function ({ filters = {}, page = 0, pageSize = 20 }) {

      const empty = {
         rows: [], total: 0, page, pageSize,
         baseAsset: filters.base ?? '', quoteAsset: filters.quote ?? '',
         quoteAssets: [], truncated: false
      }

      if (!filters.base) return empty

      const { where, params } = buildAggregationWhere(accountId, filters)

      const fills = db.query(`
         SELECT order_key AS orderKey, txid, ordertxid, time, type, ordertype,
                pair, pair_key AS pairKey, base_asset AS baseAsset, quote_asset AS quoteAsset,
                price, cost, fee, vol, margin, misc
         FROM trade
         WHERE ${where}
         ORDER BY time DESC, txid DESC
         LIMIT ?`).all(...params, FILL_LIMIT + 1)

      const truncated = fills.length > FILL_LIMIT
      if (truncated) fills.length = FILL_LIMIT
      fills.reverse()

      const kept = truncated
         ? fills.filter(fill => fill.orderKey !== fills[0].orderKey)
         : fills

      const groups = asAggregations(foldOrders(kept))
      const ordered = filters.order === 'asc' ? groups : groups.toReversed()

      return {
         rows: ordered.slice(page * pageSize, (page + 1) * pageSize),
         total: ordered.length,
         page,
         pageSize,
         baseAsset: filters.base,
         quoteAsset: filters.quote ?? '',
         quoteAssets: [...new Set(groups.flatMap(group => group.quotes.map(quote => quote.quoteAsset)))],
         truncated
      }
   }

   // The fills themselves, ungrouped: one row per trade, the way Kraken's export
   // wrote it and the way the sync stored it. Nothing is recomputed here — orders and
   // runs are the derived views above, a fill is just a row.
   this.queryTrades = function ({ filters = {}, sort = {}, page = 0, pageSize = 50 }) {

      const { where, params } = buildTradeWhere(accountId, filters)

      const column = sortableTradeColumns[sort.column] ?? sortableTradeColumns.time
      const direction = sort.direction === 'asc' ? 'ASC' : 'DESC'

      const total = db.query(`SELECT COUNT(*) AS count FROM trade WHERE ${where}`)
         .get(...params).count

      // txid breaks the tie because the fills of one order share a timestamp, and
      // without it rows shuffle between pages.
      const rows = db.query(`
         SELECT txid, ordertxid AS orderId, order_key AS orderKey, time,
                pair_key AS pair, pair AS rawPair, base_asset AS baseAsset,
                quote_asset AS quoteAsset, type AS direction, ordertype,
                price, cost, fee, vol AS volume, margin, misc
         FROM trade
         WHERE ${where}
         ORDER BY ${column} ${direction}, txid ${direction}
         LIMIT ? OFFSET ?`).all(...params, pageSize, page * pageSize)

      return { rows, total, page, pageSize }
   }

   this.distinctOrderFilters = function () {
      const column = name => db
         .query(`SELECT DISTINCT ${name} AS value FROM trade
                 WHERE account_id = ? AND ${name} <> '' ORDER BY value`)
         .all(accountId).map(row => row.value)

      const markets = db.query(`
         SELECT DISTINCT pair_key AS pairKey, base_asset AS baseAsset, quote_asset AS quoteAsset
         FROM trade
         WHERE account_id = ? AND pair_key <> ''
         ORDER BY pair_key`).all(accountId)

      return {
         pairs: column('pair_key'),
         directions: column('type'),
         ordertypes: column('ordertype'),
         markets
      }
   }

   this.clearTrades = function () {
      const deleted = this.countTrades()
      db.query('DELETE FROM trade WHERE account_id = ?').run(accountId)
      return deleted
   }
}

function foldOrders(fills) {

   const byOrder = new Map()

   for (const fill of fills) {
      const group = byOrder.get(fill.orderKey) ?? []
      group.push(fill)
      byOrder.set(fill.orderKey, group)
   }

   return [...byOrder.entries()]
      .map(([orderKey, orderFills]) => asOrder(orderKey, orderFills))
      .toSorted((a, b) => a.time - b.time || (a.orderKey < b.orderKey ? -1 : 1))
}

function asAggregations(orders) {

   const runs = []

   for (const order of orders) {
      const current = runs[runs.length - 1]
      if (current && current.direction === order.direction) current.orders.push(order)
      else runs.push({ direction: order.direction, orders: [order] })
   }

   return runs.map(asAggregation)
}

function asAggregation(run, index) {

   const orders = run.orders
   const first = orders[0]
   const last = orders[orders.length - 1]

   const byQuote = new Map()

   for (const order of orders) {
      const totals = byQuote.get(order.quoteAsset)
         ?? { volume: Big(0), cost: Big(0), fee: Big(0), netCost: Big(0), decimals: 2 }
      totals.volume = totals.volume.plus(order.volume)
      totals.cost = totals.cost.plus(order.cost)
      totals.fee = totals.fee.plus(order.fee)
      totals.netCost = totals.netCost.plus(order.netCost)
      totals.decimals = Math.max(totals.decimals, decimalCount(order.price))
      byQuote.set(order.quoteAsset, totals)
   }

   return {
      groupKey: `${index}-${first.orderKey}`,
      direction: run.direction,
      startTime: first.time,
      endTime: last.time,
      baseAsset: first.baseAsset,
      volume: orders.reduce((total, order) => total.plus(order.volume), Big(0)).toString(),
      orderCount: orders.length,
      fillCount: orders.reduce((total, order) => total + order.fillCount, 0),
      pairs: [...new Set(orders.map(order => order.pair))],
      margin: orders.some(order => order.margin),
      quotes: [...byQuote.entries()].map(([quoteAsset, totals]) => ({
         quoteAsset,
         volume: totals.volume.toString(),
         cost: totals.cost.toString(),
         fee: totals.fee.toString(),
         netCost: totals.netCost.toString(),
         price: totals.volume.eq(0) ? '0' : totals.cost.div(totals.volume).toFixed(totals.decimals)
      })),
      orders
   }
}

function asOrder(orderKey, fills) {

   const first = fills[0] ?? {}
   const sum = key => fills.reduce((total, fill) => total.plus(fill[key]), Big(0))

   const volume = sum('vol')
   const cost = sum('cost')
   const fee = sum('fee')

   // Kraken quotes each fill to the precision of the pair, so the weighted average
   // is shown to the finest precision any of them used rather than to a guess.
   const priceDecimals = Math.max(2, ...fills.map(fill => decimalCount(fill.price)))
   const price = volume.eq(0) ? Big(0) : cost.div(volume)

   // A buy pays the fee on top of what it cost; a sell has it taken out of the
   // proceeds. The page this replaces added it either way, which overstated sells.
   const netCost = first.type === 'sell' ? cost.minus(fee) : cost.plus(fee)

   return {
      orderId: first.ordertxid || '',
      orderKey,
      // Fills come back oldest first, so the first one is when the order started
      // filling — the closest thing this export has to Kraken's opentm.
      time: first.time ?? 0,
      fillCount: fills.length,
      pair: first.pairKey || first.pair || '',
      rawPair: first.pair ?? '',
      baseAsset: first.baseAsset ?? '',
      quoteAsset: first.quoteAsset ?? '',
      direction: first.type ?? '',
      ordertype: first.ordertype ?? '',
      volume: volume.toString(),
      cost: cost.toString(),
      fee: fee.toString(),
      netCost: netCost.toString(),
      price: price.toFixed(priceDecimals),
      margin: fills.some(fill => Number(fill.margin) !== 0),
      misc: first.misc ?? ''
   }
}

const decimalCount = value => (String(value).split('.')[1] ?? '').length

function buildAggregationWhere(accountId, filters) {

   const conditions = ['account_id = ?', 'base_asset = ?']
   const params = [accountId, filters.base]

   if (filters.quote && !filters.includeAllQuotes) {
      conditions.push('quote_asset = ?')
      params.push(filters.quote)
   }
   if (filters.from) {
      conditions.push('time >= ?')
      params.push(filters.from)
   }
   if (filters.to) {
      conditions.push('time <= ?')
      params.push(filters.to)
   }

   return { where: conditions.join(' AND '), params }
}

function buildTradeWhere(accountId, filters) {

   const conditions = ['account_id = ?']
   const params = [accountId]

   // Conditions are only added when set, so that an unfiltered query can still use
   // the indexes — the same reason the ledger's builder works this way.
   if (filters.pair) {
      conditions.push('pair_key = ?')
      params.push(filters.pair)
   }
   if (filters.direction) {
      conditions.push('type = ?')
      params.push(filters.direction)
   }
   if (filters.ordertype) {
      conditions.push('ordertype = ?')
      params.push(filters.ordertype)
   }
   if (filters.from) {
      conditions.push('time >= ?')
      params.push(filters.from)
   }
   if (filters.to) {
      conditions.push('time <= ?')
      params.push(filters.to)
   }
   if (filters.search) {
      conditions.push('(ordertxid LIKE ? OR txid LIKE ?)')
      params.push(`%${filters.search}%`, `%${filters.search}%`)
   }

   return { where: conditions.join(' AND '), params }
}
