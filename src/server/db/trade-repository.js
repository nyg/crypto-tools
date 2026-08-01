import Big from 'big.js'
import { getDatabase } from './database.js'

// Columns the order table may be sorted by, mapped to the aggregate that produces
// them. Anything not in here is rejected rather than interpolated into the query.
// The numeric ones read the REAL mirrors: exact decimals live in TEXT columns that
// SQLite would sort lexically ('9' after '10'), so ordering has to use the doubles
// even though the values shown to the user are recomputed exactly further down.
const sortableOrderColumns = {
   time: 'MIN(time)',
   pair: 'MIN(pair_key)',
   direction: 'MIN(type)',
   ordertype: 'MIN(ordertype)',
   volume: 'SUM(vol_num)',
   cost: 'SUM(cost_num)',
   fee: 'SUM(fee_num)',
   price: 'CASE WHEN SUM(vol_num) > 0 THEN SUM(cost_num) / SUM(vol_num) ELSE 0 END'
}

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

   // An order is a group of fills sharing an order id, so it is assembled in two
   // steps. SQL decides which orders land on the page, using the REAL mirrors; the
   // amounts shown are then recomputed from the exact decimal strings of just those
   // orders' fills, because summing doubles would surface artefacts like
   // 0.30000000000000004 in a column of money.
   this.queryOrders = function ({ filters = {}, sort = {}, page = 0, pageSize = 50 }) {

      const { where, params } = buildTradeWhere(accountId, filters)

      const column = sortableOrderColumns[sort.column] ?? sortableOrderColumns.time
      const direction = sort.direction === 'asc' ? 'ASC' : 'DESC'

      // Counting distinct groups needs no derived table only because every filter
      // above applies to a fill rather than to an aggregate of one. A filter on, say,
      // total volume would have to move to HAVING and this would have to wrap.
      const total = db.query(`SELECT COUNT(DISTINCT order_key) AS count FROM trade WHERE ${where}`)
         .get(...params).count

      // This query only picks which orders are on the page and in what order; every
      // value shown comes from the second step. A filter matches a fill, so letting
      // it decide the totals too would show an order's time and count as of the
      // fills that matched while its amounts covered all of them.
      //
      // order_key breaks ties for the same reason entry_key does in the ledger: many
      // orders share a timestamp, and without it rows shuffle between pages.
      const orderKeys = db.query(`
         SELECT order_key AS orderKey
         FROM trade
         WHERE ${where}
         GROUP BY order_key
         ORDER BY ${column} ${direction}, order_key ${direction}
         LIMIT ? OFFSET ?`).all(...params, pageSize, page * pageSize)
         .map(row => row.orderKey)

      return { rows: withExactAmounts(db, accountId, orderKeys), total, page, pageSize }
   }

   this.distinctOrderFilters = function () {
      const column = name => db
         .query(`SELECT DISTINCT ${name} AS value FROM trade
                 WHERE account_id = ? AND ${name} <> '' ORDER BY value`)
         .all(accountId).map(row => row.value)

      return { pairs: column('pair_key'), directions: column('type'), ordertypes: column('ordertype') }
   }

   this.clearTrades = function () {
      const deleted = this.countTrades()
      db.query('DELETE FROM trade WHERE account_id = ?').run(accountId)
      return deleted
   }
}

// Reads back every fill of the orders on this page and folds them with Big, so the
// totals are exact to the last digit Kraken wrote.
function withExactAmounts(db, accountId, orderKeys) {

   if (orderKeys.length === 0) return []

   const placeholders = orderKeys.map(() => '?').join(', ')

   const fills = db.query(`
      SELECT order_key AS orderKey, txid, ordertxid, time, type, ordertype,
             pair, pair_key AS pairKey, base_asset AS baseAsset, quote_asset AS quoteAsset,
             price, cost, fee, vol, margin, misc
      FROM trade
      WHERE account_id = ? AND order_key IN (${placeholders})
      ORDER BY time ASC, txid ASC`).all(accountId, ...orderKeys)

   const byOrder = new Map()
   for (const fill of fills) {
      const group = byOrder.get(fill.orderKey) ?? []
      group.push(fill)
      byOrder.set(fill.orderKey, group)
   }

   return orderKeys.map(orderKey => asOrder(orderKey, byOrder.get(orderKey) ?? []))
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
