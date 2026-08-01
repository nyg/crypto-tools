import Big from 'big.js'

// Deterministic pseudo-random source, so the fixture is identical across reloads.
function randomizer(seed) {
   let state = seed
   return (max) => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state % max
   }
}

const markets = [
   { pair: 'XXBTZUSD', pairKey: 'BTC/USD', baseAsset: 'BTC', quoteAsset: 'USD', price: 64000, volDecimals: 8, priceDecimals: 1 },
   { pair: 'XETHZUSD', pairKey: 'ETH/USD', baseAsset: 'ETH', quoteAsset: 'USD', price: 3100, volDecimals: 8, priceDecimals: 2 },
   { pair: 'SOLUSD', pairKey: 'SOL/USD', baseAsset: 'SOL', quoteAsset: 'USD', price: 148, volDecimals: 8, priceDecimals: 2 },
   { pair: 'DOTEUR', pairKey: 'DOT/EUR', baseAsset: 'DOT', quoteAsset: 'EUR', price: 6, volDecimals: 8, priceDecimals: 4 },
   { pair: 'XXBTZEUR', pairKey: 'BTC/EUR', baseAsset: 'BTC', quoteAsset: 'EUR', price: 59000, volDecimals: 8, priceDecimals: 1 }
]

const orderTypes = ['limit', 'limit', 'limit', 'market', 'stop-loss']

// One row per fill, as Kraken's trades export writes them — several rows can share
// an ordertxid, which is exactly what the page has to fold back into one order.
function buildTrades() {

   const random = randomizer(20260801)
   const trades = []
   let time = Date.UTC(2023, 1, 3, 10, 15, 0)

   for (let order = 0; trades.length < 400; order++) {

      time += (5 + random(50)) * 3600000

      const market = markets[random(markets.length)]
      const direction = random(10) < 6 ? 'buy' : 'sell'
      const ordertype = orderTypes[random(orderTypes.length)]
      const isMargin = random(20) === 0

      // Most orders fill in one go; the rest are what makes the grouping visible.
      const fillCount = random(10) < 7 ? 1 : 1 + random(3)
      // A missing order id is rare but real, and each such fill has to stand alone
      // rather than merging with every other one.
      const ordertxid = random(40) === 0 ? '' : `O${String(order).padStart(5, '0')}-MOCKD-${direction.toUpperCase()}`

      for (let fill = 0; fill < fillCount; fill++) {

         const txid = `TR${String(trades.length).padStart(5, '0')}-MOCKD-TRADE`
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
            time: time + fill * 1200,
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

// Mirrors the server: a filter selects fills, but the order it belongs to is then
// shown whole. Otherwise searching a single trade id would show that order with only
// part of its volume.
function asOrder(orderKey, fills) {

   const first = fills[0]
   const sum = key => fills.reduce((total, fill) => total.plus(fill[key]), Big(0))

   const volume = sum('vol')
   const cost = sum('cost')
   const fee = sum('fee')
   const price = volume.eq(0) ? Big(0) : cost.div(volume)
   const priceDecimals = Math.max(2, ...fills.map(fill => decimalCount(fill.price)))

   return {
      orderId: first.ordertxid || '',
      orderKey,
      time: first.time,
      fillCount: fills.length,
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
      margin: fills.some(fill => Number(fill.margin) !== 0),
      misc: first.misc
   }
}

// Grouping, filtering, sorting and paging are applied for real, so that mocked mode
// exercises the same code paths the server does.
export function tradeOrders(body = {}) {

   const keys = new Set()
   for (const trade of trades) {
      if (matches(trade, body.filters)) keys.add(trade.orderKey)
   }

   const byOrder = new Map()
   for (const trade of trades) {
      if (!keys.has(trade.orderKey)) continue
      byOrder.set(trade.orderKey, [...(byOrder.get(trade.orderKey) ?? []), trade])
   }

   const orders = [...byOrder.entries()]
      .map(([orderKey, fills]) => asOrder(orderKey, fills.toSorted((a, b) => a.time - b.time)))

   const columns = ['time', 'pair', 'direction', 'ordertype', 'volume', 'price', 'cost', 'fee']
   const column = columns.includes(body.sort?.column) ? body.sort.column : 'time'
   const factor = body.sort?.direction === 'asc' ? 1 : -1

   const numeric = ['volume', 'price', 'cost', 'fee'].includes(column)
   const value = order => numeric ? Number(order[column]) : order[column]

   const sorted = orders.toSorted((a, b) => {
      const [left, right] = [value(a), value(b)]
      if (left < right) return -factor
      if (left > right) return factor
      return a.orderKey < b.orderKey ? -factor : factor
   })

   const page = Math.max(0, body.page ?? 0)
   const pageSize = body.pageSize ?? 50

   return { rows: sorted.slice(page * pageSize, (page + 1) * pageSize), total: orders.length, page, pageSize }
}

export function tradeFilters() {
   const distinct = pick => [...new Set(trades.map(pick))].filter(Boolean).toSorted()
   return {
      pairs: distinct(trade => trade.pairKey),
      directions: distinct(trade => trade.type),
      ordertypes: distinct(trade => trade.ordertype)
   }
}
