import Big from 'big.js'
import { ledgerBalances } from './kraken-ledger'

const tradingPairs = {
   XBTUSD: { id: 'XBTUSD', name: 'XBT/USD', base: { name: 'XXBT', decimals: 8 }, quote: { name: 'ZUSD', decimals: 2 } },
   ETHUSD: { id: 'ETHUSD', name: 'ETH/USD', base: { name: 'XETH', decimals: 8 }, quote: { name: 'ZUSD', decimals: 2 } },
   XBTEUR: { id: 'XBTEUR', name: 'XBT/EUR', base: { name: 'XXBT', decimals: 8 }, quote: { name: 'ZEUR', decimals: 2 } },
   ETHEUR: { id: 'ETHEUR', name: 'ETH/EUR', base: { name: 'XETH', decimals: 8 }, quote: { name: 'ZEUR', decimals: 2 } },
   ADAUSD: { id: 'ADAUSD', name: 'ADA/USD', base: { name: 'ADA', decimals: 8 }, quote: { name: 'ZUSD', decimals: 6 } },
   DOTUSD: { id: 'DOTUSD', name: 'DOT/USD', base: { name: 'DOT', decimals: 8 }, quote: { name: 'ZUSD', decimals: 4 } },
   SOLUSD: { id: 'SOLUSD', name: 'SOL/USD', base: { name: 'SOL', decimals: 8 }, quote: { name: 'ZUSD', decimals: 4 } },
   LTCUSD: { id: 'LTCUSD', name: 'LTC/USD', base: { name: 'XLTC', decimals: 8 }, quote: { name: 'ZUSD', decimals: 2 } },
   LINKUSD: { id: 'LINKUSD', name: 'LINK/USD', base: { name: 'LINK', decimals: 8 }, quote: { name: 'ZUSD', decimals: 4 } },
   MATICUSD: { id: 'MATICUSD', name: 'MATIC/USD', base: { name: 'MATIC', decimals: 8 }, quote: { name: 'ZUSD', decimals: 6 } },
}

const randomSegment = (length) =>
   Array.from({ length }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]).join('')

const fakeTxid = () => `O${randomSegment(5)}-${randomSegment(5)}-${randomSegment(6)}`

function orderBatch(params) {
   const { direction, pair, dryRun, orders = [] } = params?.ordersParams ?? {}
   return orders.map(order => {
      const descr = `${direction} ${Big(order.volume).toFixed(5)} ${pair} @ limit ${Big(order.price).toFixed(2)}`
      const result = { descr: { order: descr } }
      if (!dryRun) {
         result.txid = fakeTxid()
      }
      return result
   })
}

// What BalanceEx and OpenOrders answer, which is what the Balances page asks Kraken
// for on top of the ledger. Built from the ledger fixture so the two agree, except for
// BTC — deliberately out of step, so the "the stored ledger is behind" path is visible
// in mocked mode without having to break a sync.
const balances = () => {

   const ledger = ledgerBalances()
   const holds = { BTC: 0.05, ADA: 400 }

   return {
      fetchedAt: Date.now(),
      assets: ledger.assets.map(asset => {
         const total = asset.totalNum + (asset.asset === 'BTC' ? 0.017 : 0)
         return {
            asset: asset.asset,
            total: total.toFixed(8),
            totalNum: total,
            hold: (holds[asset.asset] ?? 0).toFixed(8),
            holdNum: holds[asset.asset] ?? 0
         }
      }),
      openOrders: [
         {
            txid: 'OQCLML-BW3P3-BUCMWZ', baseAsset: 'BTC', quoteAsset: 'USD', pairKey: 'BTC/USD',
            type: 'sell', ordertype: 'limit', price: '71000.0', volume: '0.05000000',
            executed: '0.00000000', opened: Date.now() - 3 * 86400000
         },
         {
            txid: 'OQCLML-9XKQ2-JJTRDK', baseAsset: 'ADA', quoteAsset: 'USD', pairKey: 'ADA/USD',
            type: 'sell', ordertype: 'limit', price: '0.9200', volume: '400.00000000',
            executed: '0.00000000', opened: Date.now() - 11 * 3600000
         }
      ]
   }
}

const ladder = ({ pairKey, baseAsset, quoteAsset, type, from, to, count, volume, reference, agedHours }) =>
   Array.from({ length: count }, (unused, index) => {
      const price = from + (to - from) * (index / Math.max(1, count - 1))
      return {
         txid: fakeTxid(),
         pairKey,
         baseAsset,
         quoteAsset,
         rawPair: `${baseAsset}${quoteAsset}`,
         type,
         ordertype: 'limit',
         status: 'open',
         oflags: 'post,fciq',
         reference: reference ?? null,
         price: price.toFixed(2),
         volume: volume.toFixed(8),
         executed: '0.00000000',
         remaining: volume.toFixed(8),
         value: (price * volume).toFixed(8),
         opened: Date.now() - (agedHours + index) * 3600000
      }
   })

const buildOpenOrders = () => [
   ...ladder({
      pairKey: 'BTC/USD', baseAsset: 'BTC', quoteAsset: 'USD', type: 'buy',
      from: 52000, to: 60000, count: 14, volume: 0.0125, reference: 20260817, agedHours: 6
   }),
   ...ladder({
      pairKey: 'BTC/USD', baseAsset: 'BTC', quoteAsset: 'USD', type: 'sell',
      from: 71000, to: 74000, count: 3, volume: 0.05, reference: null, agedHours: 72
   }),
   ...ladder({
      pairKey: 'ADA/USD', baseAsset: 'ADA', quoteAsset: 'USD', type: 'sell',
      from: 0.92, to: 1.15, count: 4, volume: 400, reference: 991, agedHours: 11
   }),
   ...ladder({
      pairKey: 'ETH/EUR', baseAsset: 'ETH', quoteAsset: 'EUR', type: 'buy',
      from: 2400, to: 2650, count: 2, volume: 0.4, reference: null, agedHours: 30
   })
]

let mockOpenOrders = buildOpenOrders()

if (mockOpenOrders[0]) {
   mockOpenOrders[0] = {
      ...mockOpenOrders[0],
      executed: '0.00500000',
      remaining: '0.00750000',
      value: (Number(mockOpenOrders[0].price) * 0.0075).toFixed(8)
   }
}

const openOrders = () => ({
   fetchedAt: Date.now(),
   orders: mockOpenOrders.toSorted((a, b) => b.opened - a.opened),
   prices: { 'BTC/USD': 62500, 'ADA/USD': 0.46, 'ETH/EUR': 2820 }
})

const cancelOrders = (params) => {
   const txids = new Set(params?.txids ?? [])
   const before = mockOpenOrders.length
   mockOpenOrders = mockOpenOrders.filter(order => !txids.has(order.txid))
   return { count: before - mockOpenOrders.length }
}

// Roughly the market as of the fixture's writing. SOL has no mocked rate on purpose,
// so the "no USD pair" path stays visible in mocked mode.
const assetRates = (params) => {
   const known = { BTC: 62500, ETH: 3050, DOT: 6.4, ADA: 0.46, LINK: 12.5, USD: 1 }
   return {
      rates: (params?.assets ?? [])
         .filter(asset => known[asset] !== undefined)
         .reduce((rates, asset) => ({ ...rates, [asset]: known[asset] }), { USD: 1 })
   }
}

const xstockSeed = [
   { ticker: 'AAPL', name: 'Apple Inc.', type: 'stock', subtype: '', origin: 'seed' },
   { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.', type: 'stock', subtype: '', origin: 'seed' },
   { ticker: 'LNG', name: 'Cheniere Energy, Inc.', type: 'stock', subtype: '', origin: 'seed' },
   { ticker: 'NVDA', name: 'NVIDIA Corporation', type: 'stock', subtype: '', origin: 'seed' },
   { ticker: 'STRC', name: 'Strategy Inc. Variable Rate Series A Perpetual Stretch Preferred Stock', type: 'stock', subtype: 'preferred', origin: 'seed' },
   { ticker: 'TSLA', name: 'Tesla, Inc.', type: 'stock', subtype: '', origin: 'seed' },
   { ticker: 'GLD', name: 'SPDR Gold Shares', type: 'etf', subtype: 'commodity-trust', origin: 'seed' },
   { ticker: 'SGOV', name: 'iShares 0-3 Month Treasury Bond ETF', type: 'etf', subtype: 'bond', origin: 'seed' },
   { ticker: 'SPY', name: 'State Street SPDR S&P 500 ETF', type: 'etf', subtype: '', origin: 'seed' },
   { ticker: 'TQQQ', name: 'ProShares UltraPro QQQ', type: 'etf', subtype: 'leveraged', origin: 'seed' },
   { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'etf', subtype: '', origin: 'seed' },
   { ticker: 'KRAQ', name: '', type: 'unclassified', subtype: '', origin: '' },
   { ticker: 'JMKE', name: '', type: 'unclassified', subtype: '', origin: '' },
]

const mockDescriptions = new Map()
const mockClassifications = new Map()

const describedKey = (ticker, wordCount) => `${ticker}:${wordCount}`

const mockVolumes = {
   AAPL: [311.96, 83.88], GLD: [399.13, 443.43], NVDA: [182.4, 210.5],
   TSLA: [330.51, 395.83], SPY: [772.35, 120.79], VOO: [604.2, 31.4],
   TQQQ: [92.7, 512.6], SGOV: [100.4, 88.2], 'BRK.B': [512.8, 9.6],
   LNG: [242.1, 12.4], STRC: [98.3, 640.1], KRAQ: [10.4, 1204.6]
}

const xstockListings = (params) => {
   const wordCount = params?.wordCount ?? 60
   return {
      wordCount,
      listings: xstockSeed.map(listing => {
         const classified = mockClassifications.get(listing.ticker)
         const market = mockVolumes[listing.ticker]
         return {
            ...listing,
            ...classified,
            altname: `${listing.ticker}x`,
            exchange: '',
            confidence: listing.origin === 'seed' ? 'high' : classified?.confidence ?? '',
            sources: [],
            last: market?.[0] ?? null,
            volume24h: market?.[1] ?? null,
            volumeUsd24h: market ? market[0] * market[1] : null,
            description: mockDescriptions.get(describedKey(listing.ticker, wordCount)) ?? ''
         }
      })
   }
}

const xstockClassify = (params) => {
   const classified = (params?.tickers ?? []).map(ticker => ({
      ticker,
      altname: `${ticker}x`,
      name: ticker === 'KRAQ' ? 'KRAKacquisition Corp.' : 'Jersey Mike\'s Subs Inc.',
      exchange: 'NASDAQ',
      type: 'stock',
      subtype: '',
      confidence: 'high',
      sources: ['https://example.com/mock-source'],
      origin: 'ai'
   }))

   for (const listing of classified) {
      mockClassifications.set(listing.ticker, listing)
   }

   return { classified }
}

const xstockDescribe = (params) => {
   const wordCount = params?.wordCount ?? 60
   const described = (params?.tickers ?? []).map(ticker => ({
      ticker,
      description: `Mocked ${wordCount}-word description for ${ticker}. Generated without contacting `
         + 'Anthropic, so it is filler rather than anything you should read as fact. Click to expand '
         + 'and collapse this text the way a real description behaves.',
      sources: ['https://example.com/mock-source']
   }))

   for (const item of described) {
      mockDescriptions.set(describedKey(item.ticker, wordCount), item.description)
   }

   return { described, wordCount }
}

export {
   tradingPairs, orderBatch, balances, assetRates, openOrders, cancelOrders,
   xstockListings, xstockClassify, xstockDescribe
}
