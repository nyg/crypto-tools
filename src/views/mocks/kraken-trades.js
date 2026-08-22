import Big from 'big.js'

// Deterministic pseudo-random source, so the fixture is identical across reloads.
function randomizer(seed) {
   let state = seed
   return (max) => {
      state = (state * 1103515245 + 12345) % 2147483648
      return Math.floor(state / 65536) % max
   }
}

const markets = [
   { pair: 'XXBTZUSD', pairKey: 'BTC/USD', baseAsset: 'BTC', quoteAsset: 'USD', price: 64000, volDecimals: 8, priceDecimals: 1 },
   { pair: 'XETHZUSD', pairKey: 'ETH/USD', baseAsset: 'ETH', quoteAsset: 'USD', price: 3100, volDecimals: 8, priceDecimals: 2 },
   { pair: 'SOLUSD', pairKey: 'SOL/USD', baseAsset: 'SOL', quoteAsset: 'USD', price: 148, volDecimals: 8, priceDecimals: 2 },
   { pair: 'DOTEUR', pairKey: 'DOT/EUR', baseAsset: 'DOT', quoteAsset: 'EUR', price: 6, volDecimals: 8, priceDecimals: 4 },
   { pair: 'XXBTZEUR', pairKey: 'BTC/EUR', baseAsset: 'BTC', quoteAsset: 'EUR', price: 59000, volDecimals: 8, priceDecimals: 1 },
   { pair: 'XBTCHF', pairKey: 'BTC/CHF', baseAsset: 'BTC', quoteAsset: 'CHF', price: 55000, volDecimals: 8, priceDecimals: 1 }
]

const orderTypes = ['limit', 'limit', 'limit', 'market', 'stop-loss']

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const idSegment = (random, length) =>
   Array.from({ length }, () => ID_ALPHABET[random(ID_ALPHABET.length)]).join('')

const krakenId = (prefix, random) =>
   `${prefix}${idSegment(random, 5)}-${idSegment(random, 5)}-${idSegment(random, 6)}`

// One row per trade, as Kraken's trades export writes them — several rows can share
// an ordertxid, which is exactly what the page has to fold back into one order.
function buildTrades() {

   const random = randomizer(20260801)
   const trades = []
   let time = Date.now() - 1250 * 86400000

   for (let order = 0; trades.length < 400; order++) {

      time += (12 + random(160)) * 3600000

      const market = markets[random(markets.length)]
      const direction = random(10) < 6 ? 'buy' : 'sell'
      const ordertype = orderTypes[random(orderTypes.length)]
      const isMargin = random(20) === 0

      // Most orders fill in one go; the rest are what makes the grouping visible.
      const tradeCount = random(10) < 7 ? 1 : 1 + random(3)
      // A missing order id is rare but real, and each such trade has to stand alone
      // rather than merging with every other one.
      const ordertxid = random(40) === 0 ? '' : krakenId('O', random)

      for (let index = 0; index < tradeCount; index++) {

         const txid = krakenId('T', random)
         const price = Big(market.price).plus(random(market.price / 10)).minus(market.price / 20)
         const vol = Big(1 + random(400000)).div(1000000 * (market.price > 1000 ? 1 : 0.01))
         const cost = price.times(vol)

         trades.push({
            txid,
            ordertxid,
            orderKey: ordertxid || txid,
            pair: market.pair,
            pairKey: market.pairKey,
            baseAsset: market.baseAsset,
            quoteAsset: market.quoteAsset,
            time: time + index * 1200,
            type: direction,
            ordertype,
            price: price.toFixed(market.priceDecimals),
            cost: cost.toFixed(4),
            fee: cost.times(0.0025).toFixed(4),
            vol: vol.toFixed(market.volDecimals),
            margin: isMargin ? cost.div(2).toFixed(4) : '0',
            misc: ''
         })
      }
   }

   return trades.toSorted((a, b) => a.time - b.time)
}

let trades = buildTrades()
const allTrades = trades

export function tradeCount() {
   return trades.length
}

export function allTradeCount() {
   return allTrades.length
}

export function orderCount() {
   return new Set(trades.map(trade => trade.orderKey)).size
}

export function clearTrades() {
   const deleted = trades.length
   trades = []
   return deleted
}

export function restoreTrades() {
   trades = allTrades
}

function matches(trade, filters = {}) {
   const search = filters.search?.toLowerCase()
   return (!filters.pair || trade.pairKey === filters.pair)
      && (!filters.direction || trade.type === filters.direction)
      && (!filters.ordertype || trade.ordertype === filters.ordertype)
      && (!filters.from || trade.time >= filters.from)
      && (!filters.to || trade.time <= filters.to)
      && (!search
         || trade.ordertxid.toLowerCase().includes(search)
         || trade.txid.toLowerCase().includes(search))
}

const decimalCount = value => (String(value).split('.')[1] ?? '').length

// Mirrors the server: a filter selects trades, but the order it belongs to is then
// shown whole. Otherwise searching a single trade id would show that order with only
// part of its volume.
function asOrder(orderKey, trades) {

   const first = trades[0]
   const sum = key => trades.reduce((total, trade) => total.plus(trade[key]), Big(0))

   const volume = sum('vol')
   const cost = sum('cost')
   const fee = sum('fee')
   const price = volume.eq(0) ? Big(0) : cost.div(volume)
   const priceDecimals = Math.max(2, ...trades.map(trade => decimalCount(trade.price)))

   return {
      orderId: first.ordertxid || '',
      orderKey,
      time: first.time,
      tradeCount: trades.length,
      pair: first.pairKey,
      rawPair: first.pair,
      baseAsset: first.baseAsset,
      quoteAsset: first.quoteAsset,
      direction: first.type,
      ordertype: first.ordertype,
      volume: volume.toString(),
      cost: cost.toString(),
      fee: fee.toString(),
      netCost: (first.type === 'sell' ? cost.minus(fee) : cost.plus(fee)).toString(),
      price: price.toFixed(priceDecimals),
      margin: trades.some(trade => Number(trade.margin) !== 0),
      misc: first.misc
   }
}

// Grouping, filtering and paging are applied for real, so that mocked mode exercises
// the same code paths the server does.
export function tradeAggregations(body = {}) {

   const filters = body.filters ?? {}
   const page = Math.max(0, body.page ?? 0)
   const pageSize = body.pageSize ?? 20

   const empty = {
      rows: [], total: 0, page, pageSize,
      baseAsset: filters.base ?? '', quoteAsset: filters.quote ?? '',
      quoteAssets: [], summary: emptySummary(), truncated: false
   }

   if (!filters.base) return empty

   const matched = trades.filter(trade =>
      trade.baseAsset === filters.base
      && (filters.includeAllQuotes || !filters.quote || trade.quoteAsset === filters.quote)
      && (!filters.from || trade.time >= filters.from)
      && (!filters.to || trade.time <= filters.to))

   const byOrder = new Map()
   for (const trade of matched) {
      byOrder.set(trade.orderKey, [...(byOrder.get(trade.orderKey) ?? []), trade])
   }

   const orders = [...byOrder.entries()]
      .map(([orderKey, orderTrades]) => asOrder(orderKey, orderTrades.toSorted((a, b) => a.time - b.time)))
      .toSorted((a, b) => a.time - b.time || (a.orderKey < b.orderKey ? -1 : 1))

   const runs = []
   for (const order of orders) {
      const current = runs[runs.length - 1]
      if (current && current.direction === order.direction) current.orders.push(order)
      else runs.push({ direction: order.direction, orders: [order] })
   }

   const groups = runs.map(asAggregation)
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
      truncated: false
   }
}

function asSummary(orders) {

   const sides = { buy: newSummarySide(), sell: newSummarySide() }

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

function newSummarySide() {
   return { orderCount: 0, tradeCount: 0, byQuote: new Map() }
}

function asSummarySide(side) {
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

function emptySummary() {
   return { buy: asSummarySide(newSummarySide()), sell: asSummarySide(newSummarySide()) }
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

// The trades themselves, ungrouped, as the Ledger page's Trades tab reads them. A
// filter selects a row here rather than the order behind it — nothing is folded.
export function tradeRows(body = {}) {

   const filtered = trades.filter(trade => matches(trade, body.filters))

   const columns = ['time', 'pair', 'direction', 'ordertype', 'volume', 'price', 'cost', 'fee']
   const column = columns.includes(body.sort?.column) ? body.sort.column : 'time'
   const factor = body.sort?.direction === 'asc' ? 1 : -1

   const numeric = ['volume', 'price', 'cost', 'fee'].includes(column)
   const value = trade => {
      if (column === 'volume') return Number(trade.vol)
      if (column === 'pair') return trade.pairKey
      if (column === 'direction') return trade.type
      if (numeric) return Number(trade[column])
      return trade[column]
   }

   const sorted = filtered.toSorted((a, b) => {
      const [left, right] = [value(a), value(b)]
      if (left < right) return -factor
      if (left > right) return factor
      return a.txid < b.txid ? -factor : factor
   })

   const page = Math.max(0, body.page ?? 0)
   const pageSize = body.pageSize ?? 50

   // The server renames columns on the way out; the fixture has to answer in the same
   // shape or the table would render blanks under mocked data only.
   const rows = sorted.slice(page * pageSize, (page + 1) * pageSize).map(trade => ({
      txid: trade.txid,
      orderId: trade.ordertxid,
      orderKey: trade.orderKey,
      time: trade.time,
      pair: trade.pairKey,
      rawPair: trade.pair,
      baseAsset: trade.baseAsset,
      quoteAsset: trade.quoteAsset,
      direction: trade.type,
      ordertype: trade.ordertype,
      price: trade.price,
      cost: trade.cost,
      fee: trade.fee,
      volume: trade.vol,
      margin: trade.margin,
      misc: trade.misc
   }))

   return { rows, total: filtered.length, page, pageSize }
}

export function tradeFilters() {

   const distinct = pick => [...new Set(trades.map(pick))].filter(Boolean).toSorted()

   const markets = [...new Map(trades.map(trade =>
      [trade.pairKey, { pairKey: trade.pairKey, baseAsset: trade.baseAsset, quoteAsset: trade.quoteAsset }]))
      .values()]
      .toSorted((a, b) => a.pairKey.localeCompare(b.pairKey))

   return {
      pairs: distinct(trade => trade.pairKey),
      directions: distinct(trade => trade.type),
      ordertypes: distinct(trade => trade.ordertype),
      markets
   }
}
