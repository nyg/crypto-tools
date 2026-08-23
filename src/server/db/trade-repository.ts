import Big from 'big.js'
import type { Database, SQLQueryBindings } from 'bun:sqlite'
import { getDatabase } from './database'
import type { CountRow, MarketRow, TimeRangeRow, TradeListRow, TradeRow, ValueRow } from '../../types/db'
import type {
   Aggregation, AggregationsResponse, AggregationSummary, Order, SummarySide, TradesResponse
} from '../../types/api'
import type { AggregationFilters, Sort, Trade, TradeFilters } from '../../types/kraken'

type Params = SQLQueryBindings[]
type NamedParams = Record<string, string | number | bigint | boolean | null>

// Columns the ungrouped trades may be sorted by, mapped to the column that produces
// them. Anything not in here is rejected rather than interpolated into the query.
// The numeric ones read the REAL mirrors: exact decimals live in TEXT columns that
// SQLite would sort lexically ('9' after '10'), so ordering has to use the doubles
// even though the values shown to the user are the exact strings.
const sortableTradeColumns: Record<string, string> = {
   time: 'time',
   pair: 'pair_key',
   direction: 'type',
   ordertype: 'ordertype',
   volume: 'vol_num',
   price: 'price_num',
   cost: 'cost_num',
   fee: 'fee_num'
}

const TRADE_LIMIT = 50000

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

export default class TradeRepository {

   readonly #db: Database
   readonly #accountId: string

   // Every statement below is scoped by account_id, like the ledger's, so two Kraken
   // accounts stored side by side can never read or overwrite each other's trades.
   constructor(accountId: string) {
      this.#db = getDatabase()
      this.#accountId = accountId
   }

   upsertTrades(trades: Trade[], syncedAt: number): void {

      const insert = this.#db.prepare<void, NamedParams>(upsertStatement)

      this.#db.transaction(() => {
         for (const trade of trades) {
            insert.run({
               $accountId: this.#accountId,
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

   countTrades(): number {
      return this.#db.query<CountRow, Params>('SELECT COUNT(*) AS count FROM trade WHERE account_id = ?')
         .get(this.#accountId)!.count
   }

   countOrders(): number {
      return this.#db.query<CountRow, Params>('SELECT COUNT(DISTINCT order_key) AS count FROM trade WHERE account_id = ?')
         .get(this.#accountId)!.count
   }

   tradeTimeRange(): TimeRangeRow {
      const range = this.#db.query<TimeRangeRow, Params>(`
         SELECT MIN(time) AS first, MAX(time) AS last
         FROM trade WHERE account_id = ?`).get(this.#accountId)!
      return { first: range.first ?? null, last: range.last ?? null }
   }

   queryAggregations({ filters = {}, page = 0, pageSize = 20 }: AggregationsQuery): AggregationsResponse {

      const empty = {
         rows: [], total: 0, page, pageSize,
         baseAsset: filters.base ?? '', quoteAsset: filters.quote ?? '',
         quoteAssets: [], summary: emptySummary(), truncated: false
      }

      if (!filters.base) return empty

      const { where, params } = buildAggregationWhere(this.#accountId, filters)

      const trades = this.#db.query<TradeRow, Params>(`
         SELECT order_key AS orderKey, txid, ordertxid, time, type, ordertype,
                pair, pair_key AS pairKey, base_asset AS baseAsset, quote_asset AS quoteAsset,
                price, cost, fee, vol, margin, misc
         FROM trade
         WHERE ${where}
         ORDER BY time DESC, txid DESC
         LIMIT ?`).all(...params, TRADE_LIMIT + 1)

      const truncated = trades.length > TRADE_LIMIT
      if (truncated) trades.length = TRADE_LIMIT
      trades.reverse()

      const kept = truncated
         ? trades.filter(trade => trade.orderKey !== trades[0].orderKey)
         : trades

      const orders = foldOrders(kept)
      const groups = asAggregations(orders)
      const ordered = filters.order === 'asc' ? groups : groups.toReversed()

      return {
         rows: ordered.slice(page * pageSize, (page + 1) * pageSize),
         total: ordered.length,
         page,
         pageSize,
         baseAsset: filters.base,
         quoteAsset: filters.quote ?? '',
         quoteAssets: [...new Set(groups.flatMap(group => group.quotes.map(quote => quote.quoteAsset)))],
         summary: asSummary(orders),
         truncated
      }
   }

   // The trades themselves, ungrouped: one row per trade, the way Kraken's export
   // wrote it and the way the sync stored it. Nothing is recomputed here — orders and
   // runs are the derived views above, a trade is just a row.
   queryTrades({ filters = {}, sort = {}, page = 0, pageSize = 50 }: TradesQuery): TradesResponse {

      const { where, params } = buildTradeWhere(this.#accountId, filters)

      const column = sortableTradeColumns[sort.column ?? ''] ?? sortableTradeColumns.time
      const direction = sort.direction === 'asc' ? 'ASC' : 'DESC'

      const total = this.#db.query<CountRow, Params>(`SELECT COUNT(*) AS count FROM trade WHERE ${where}`)
         .get(...params)!.count

      // txid breaks the tie because the trades of one order share a timestamp, and
      // without it rows shuffle between pages.
      const rows = this.#db.query<TradeListRow, Params>(`
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

   distinctOrderFilters() {
      const column = (name: string) => this.#db
         .query<ValueRow, Params>(`SELECT DISTINCT ${name} AS value FROM trade
                 WHERE account_id = ? AND ${name} <> '' ORDER BY value`)
         .all(this.#accountId).map(row => row.value)

      const markets = this.#db.query<MarketRow, Params>(`
         SELECT DISTINCT pair_key AS pairKey, base_asset AS baseAsset, quote_asset AS quoteAsset
         FROM trade
         WHERE account_id = ? AND pair_key <> ''
         ORDER BY pair_key`).all(this.#accountId)

      return {
         pairs: column('pair_key'),
         directions: column('type'),
         ordertypes: column('ordertype'),
         markets
      }
   }

   clearTrades(): number {
      const deleted = this.countTrades()
      this.#db.query<void, Params>('DELETE FROM trade WHERE account_id = ?').run(this.#accountId)
      return deleted
   }
}

interface AggregationsQuery {
   filters?: AggregationFilters
   page?: number
   pageSize?: number
}

interface TradesQuery {
   filters?: TradeFilters
   sort?: Sort
   page?: number
   pageSize?: number
}

// Exact totals per quote currency while a run is being folded, before they are turned
// back into the strings the page reads.
interface QuoteFold {
   volume: Big
   cost: Big
   fee: Big
   netCost: Big
   decimals: number
}

interface SideFold {
   orderCount: number
   tradeCount: number
   byQuote: Map<string, QuoteFold>
}

// Both sides of the whole selection, so the page can show what the range averages
// out to. Every order in the range counts, not only the ones on the current page,
// and each side keeps its quote currencies apart the way a run does — the view
// converts them once it knows which quote to total in.
function asSummary(orders: Order[]): AggregationSummary {

   const sides: Record<string, SideFold> = { buy: newSummarySide(), sell: newSummarySide() }

   for (const order of orders) {

      const side = sides[order.direction]
      if (!side) continue

      side.orderCount += 1
      side.tradeCount += order.tradeCount

      const totals = side.byQuote.get(order.quoteAsset)
         ?? { volume: Big(0), cost: Big(0), fee: Big(0), netCost: Big(0), decimals: 2 }
      totals.volume = totals.volume.plus(order.volume)
      totals.cost = totals.cost.plus(order.cost)
      totals.fee = totals.fee.plus(order.fee)
      totals.netCost = totals.netCost.plus(order.netCost)
      totals.decimals = Math.max(totals.decimals, decimalCount(order.price))
      side.byQuote.set(order.quoteAsset, totals)
   }

   return { buy: asSummarySide(sides.buy), sell: asSummarySide(sides.sell) }
}

function newSummarySide(): SideFold {
   return { orderCount: 0, tradeCount: 0, byQuote: new Map<string, QuoteFold>() }
}

function asSummarySide(side: SideFold): SummarySide {
   return {
      orderCount: side.orderCount,
      tradeCount: side.tradeCount,
      volume: [...side.byQuote.values()]
         .reduce((total, totals) => total.plus(totals.volume), Big(0)).toString(),
      quotes: [...side.byQuote.entries()].map(([quoteAsset, totals]) => ({
         quoteAsset,
         volume: totals.volume.toString(),
         cost: totals.cost.toString(),
         fee: totals.fee.toString(),
         netCost: totals.netCost.toString(),
         price: totals.volume.eq(0) ? '0' : totals.cost.div(totals.volume).toFixed(totals.decimals)
      }))
   }
}

function emptySummary(): AggregationSummary {
   return { buy: asSummarySide(newSummarySide()), sell: asSummarySide(newSummarySide()) }
}

function foldOrders(trades: TradeRow[]): Order[] {

   const byOrder = new Map<string, TradeRow[]>()

   for (const trade of trades) {
      const group = byOrder.get(trade.orderKey) ?? []
      group.push(trade)
      byOrder.set(trade.orderKey, group)
   }

   return [...byOrder.entries()]
      .map(([orderKey, orderTrades]) => asOrder(orderKey, orderTrades))
      .toSorted((a, b) => a.time - b.time || (a.orderKey < b.orderKey ? -1 : 1))
}

function asAggregations(orders: Order[]): Aggregation[] {

   const runs: { direction: string, orders: Order[] }[] = []

   for (const order of orders) {
      const current = runs[runs.length - 1]
      if (current && current.direction === order.direction) current.orders.push(order)
      else runs.push({ direction: order.direction, orders: [order] })
   }

   return runs.map(asAggregation)
}

function asAggregation(run: { direction: string, orders: Order[] }, index: number): Aggregation {

   const orders = run.orders
   const first = orders[0]
   const last = orders[orders.length - 1]

   const byQuote = new Map<string, QuoteFold>()

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
      tradeCount: orders.reduce((total, order) => total + order.tradeCount, 0),
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

function asOrder(orderKey: string, trades: TradeRow[]): Order {

   const first = trades[0] ?? {} as Partial<TradeRow>
   const sum = (key: 'vol' | 'cost' | 'fee') =>
      trades.reduce((total, trade) => total.plus(trade[key]), Big(0))

   const volume = sum('vol')
   const cost = sum('cost')
   const fee = sum('fee')

   // Kraken quotes each trade to the precision of the pair, so the weighted average
   // is shown to the finest precision any of them used rather than to a guess.
   const priceDecimals = Math.max(2, ...trades.map(trade => decimalCount(trade.price)))
   const price = volume.eq(0) ? Big(0) : cost.div(volume)

   // A buy pays the fee on top of what it cost; a sell has it taken out of the
   // proceeds. The page this replaces added it either way, which overstated sells.
   const netCost = first.type === 'sell' ? cost.minus(fee) : cost.plus(fee)

   return {
      orderId: first.ordertxid || '',
      orderKey,
      // Trades come back oldest first, so the first one is when the order started
      // filling — the closest thing this export has to Kraken's opentm.
      time: first.time ?? 0,
      tradeCount: trades.length,
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
      margin: trades.some(trade => Number(trade.margin) !== 0),
      misc: first.misc ?? ''
   }
}

const decimalCount = (value: string) => (String(value).split('.')[1] ?? '').length

function buildAggregationWhere(accountId: string, filters: AggregationFilters) {

   const conditions = ['account_id = ?', 'base_asset = ?']
   const params: Params = [accountId, filters.base ?? '']

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

function buildTradeWhere(accountId: string, filters: TradeFilters) {

   const conditions = ['account_id = ?']
   const params: Params = [accountId]

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
