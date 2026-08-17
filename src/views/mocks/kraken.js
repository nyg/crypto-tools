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

const mockActivities = [
   'Asking Claude…',
   'Searching the web for “latest holdings and expense ratio”',
   'Reading what the search found…',
   'Writing the answer…'
]

let mockJob = null

const mockStep = (ticker, group) => ({
   ticker, group, phase: 'pending', activity: '', searches: [],
   startedAt: null, finishedAt: null, error: null
})

const startMockJob = (kind, tickers, wordCount, groupSize) => {

   const groups = []
   for (let index = 0; index < tickers.length; index += groupSize) {
      groups.push(tickers.slice(index, index + groupSize))
   }

   mockJob = {
      kind,
      wordCount,
      phase: 'running',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      finishedAt: null,
      steps: groups.flatMap((group, index) => group.map(ticker => mockStep(ticker, index))),
      error: null,
      cancelRequested: false,
      ticks: 0
   }

   return { job: structuredClone(mockJob), alreadyRunning: false }
}

const snapshot = () => ({ job: mockJob ? structuredClone(mockJob) : null })

const advanceMockJob = () => {

   if (!mockJob || mockJob.phase !== 'running') return snapshot()

   mockJob.ticks++
   mockJob.updatedAt = Date.now()

   const running = mockJob.steps.filter(step => step.phase === 'running')

   for (const step of running) {
      step.activity = mockActivities[Math.min(mockJob.ticks % 5, mockActivities.length - 1)]
   }

   if (mockJob.ticks % 4 === 0) {
      for (const step of running) {
         step.phase = 'done'
         step.activity = ''
         step.finishedAt = Date.now()
         if (mockJob.kind === 'describe') storeMockDescription(step.ticker, mockJob.wordCount)
         else storeMockClassification(step.ticker)
      }
   }

   if (!mockJob.steps.some(step => step.phase === 'running')) {
      const next = mockJob.steps.find(step => step.phase === 'pending')
      if (next) {
         for (const step of mockJob.steps.filter(s => s.group === next.group)) {
            step.phase = 'running'
            step.startedAt = Date.now()
            step.activity = mockActivities[0]
         }
      }
      else {
         mockJob.phase = 'done'
         mockJob.finishedAt = Date.now()
      }
   }

   return snapshot()
}

const storeMockClassification = (ticker) => {
   mockClassifications.set(ticker, {
      ticker,
      altname: `${ticker}x`,
      name: ticker === 'KRAQ' ? 'KRAKacquisition Corp.' : 'Jersey Mike\'s Subs Inc.',
      exchange: 'NASDAQ',
      type: 'stock',
      subtype: '',
      confidence: 'high',
      sources: ['https://example.com/mock-source'],
      origin: 'ai'
   })
}

const storeMockDescription = (ticker, wordCount) => {
   mockDescriptions.set(describedKey(ticker, wordCount),
      `Mocked ${wordCount}-word description for ${ticker}. Generated without contacting `
      + 'Anthropic, so it is filler rather than anything you should read as fact. Click to expand '
      + 'and collapse this text the way a real description behaves.')
}

const xstockClassify = (params) =>
   startMockJob('classify', params?.tickers ?? [], null, 10)

const xstockDescribe = (params) =>
   startMockJob('describe', params?.tickers ?? [], params?.wordCount ?? 60, 1)

const xstockJob = () => advanceMockJob()

const xstockJobCancel = () => {
   if (mockJob?.phase === 'running') {
      mockJob.cancelRequested = true
      mockJob.phase = 'cancelled'
      mockJob.finishedAt = Date.now()
      for (const step of mockJob.steps) {
         if (step.phase === 'running' || step.phase === 'pending') step.phase = 'cancelled'
      }
   }
   return snapshot()
}

export {
   tradingPairs, orderBatch, balances, assetRates,
   xstockListings, xstockClassify, xstockDescribe, xstockJob, xstockJobCancel
}
