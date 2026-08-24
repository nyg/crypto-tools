import Big from 'big.js'
import { ledgerBalances } from './kraken-ledger'
import type {
   AssetRatesResponse, BalancesResponse, OpenOrdersResponse,
   XStockJobResponse, XStockListingsResponse, XStockRow, XStockStartResponse
} from '../../types/api'
import type { XStockClassification, XStockListingType } from '../../types/xstock'
import type { KrakenOrderBatchParams } from '../../types/kraken-api'
import type { TradingPairs } from '../../types/market'
import type { CancelResult, OpenOrder } from '../../types/kraken'
import type { XStockJob, XStockJobKind, XStockStep } from '../../types/jobs'

// The mocked job carries a tick counter the real one has no use for: it is what drives
// the fake progress the page polls.
type MockJob = XStockJob & { ticks: number }

const tradingPairs: TradingPairs = {
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

const randomSegment = (length: number) =>
   Array.from({ length }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]).join('')

const fakeTxid = () => `O${randomSegment(5)}-${randomSegment(5)}-${randomSegment(6)}`

function orderBatch(params?: { ordersParams?: KrakenOrderBatchParams }) {
   const { direction, pair, dryRun, orders = [] } = params?.ordersParams ?? {}
   return orders.map(order => {
      const descr = `${direction} ${Big(order.volume).toFixed(5)} ${pair} @ limit ${Big(order.price).toFixed(2)}`
      const result: { descr: { order: string }, txid?: string } = { descr: { order: descr } }
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
const balances = (): BalancesResponse => {

   const ledger = ledgerBalances()
   const holds: Record<string, number> = { BTC: 0.05, ADA: 400 }

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
         mockOrder({
            txid: 'OQCLML-BW3P3-BUCMWZ', baseAsset: 'BTC', quoteAsset: 'USD', pairKey: 'BTC/USD',
            type: 'sell', price: '71000.0', volume: '0.05000000',
            opened: Date.now() - 3 * 86400000
         }),
         mockOrder({
            txid: 'OQCLML-9XKQ2-JJTRDK', baseAsset: 'ADA', quoteAsset: 'USD', pairKey: 'ADA/USD',
            type: 'sell', price: '0.9200', volume: '400.00000000',
            opened: Date.now() - 11 * 3600000
         })
      ]
   }
}

// The fields a mocked order is worth spelling out; everything else an OpenOrder
// carries is filled in the same way for all of them.
type MockOrderSeed = Pick<OpenOrder, 'txid' | 'pairKey' | 'baseAsset' | 'quoteAsset' | 'type'>
   & { price: string, volume: string, opened: number, reference?: number | null }

const mockOrder = ({
   txid, pairKey, baseAsset, quoteAsset, type, price, volume, opened, reference = null
}: MockOrderSeed): OpenOrder => ({
   txid,
   pairKey,
   baseAsset,
   quoteAsset,
   rawPair: `${baseAsset}${quoteAsset}`,
   type,
   ordertype: 'limit',
   description: `${type} ${volume} ${baseAsset}${quoteAsset} @ limit ${price}`,
   status: 'open',
   oflags: 'post,fciq',
   reference,
   price,
   volume,
   executed: '0.00000000',
   remaining: volume,
   value: (Number(price) * Number(volume)).toFixed(8),
   opened
})

interface LadderSeed {
   pairKey: string
   baseAsset: string
   quoteAsset: string
   type: string
   from: number
   to: number
   count: number
   volume: number
   reference: number | null
   agedHours: number
}

const ladder = ({
   pairKey, baseAsset, quoteAsset, type, from, to, count, volume, reference, agedHours
}: LadderSeed): OpenOrder[] =>
   Array.from({ length: count }, (unused, index) => {
      const price = from + (to - from) * (index / Math.max(1, count - 1))
      return mockOrder({
         txid: fakeTxid(),
         pairKey,
         baseAsset,
         quoteAsset,
         type,
         reference,
         price: price.toFixed(2),
         volume: volume.toFixed(8),
         opened: Date.now() - (agedHours + index) * 3600000
      })
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

const openOrders = (): OpenOrdersResponse => ({
   fetchedAt: Date.now(),
   orders: mockOpenOrders.toSorted((a, b) => b.opened - a.opened),
   prices: { 'BTC/USD': 62500, 'ADA/USD': 0.46, 'ETH/EUR': 2820 }
})

const cancelOrders = (params?: { txids?: string[] }): CancelResult => {
   const txids = new Set(params?.txids ?? [])
   const before = mockOpenOrders.length
   mockOpenOrders = mockOpenOrders.filter(order => !txids.has(order.txid))
   return { count: before - mockOpenOrders.length }
}

// Roughly the market as of the fixture's writing. SOL and CHF have no mocked rate on
// purpose, so the "no USD pair" path stays visible in mocked mode.
const assetRates = (params?: { assets?: string[] }): AssetRatesResponse => {
   const known: Record<string, number> = {
      BTC: 62500, ETH: 3050, DOT: 6.4, ADA: 0.46, LINK: 12.5, SOL: 148,
      USD: 1, EUR: 1.08, USDT: 1, USDC: 1
   }
   return {
      rates: (params?.assets ?? [])
         .filter(asset => known[asset] !== undefined)
         .reduce<Record<string, number>>((rates, asset) => ({ ...rates, [asset]: known[asset] }), { USD: 1 })
   }
}

const xstockSeed: {
   ticker: string
   name: string
   type: XStockListingType
   subtype: string
   origin: string
}[] = [
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

const mockDescriptions = new Map<string, string>()
const mockClassifications = new Map<string, XStockClassification>()

const describedKey = (ticker: string, wordCount: number) => `${ticker}:${wordCount}`

const mockVolumes: Record<string, [number, number]> = {
   AAPL: [311.96, 83.88], GLD: [399.13, 443.43], NVDA: [182.4, 210.5],
   TSLA: [330.51, 395.83], SPY: [772.35, 120.79], VOO: [604.2, 31.4],
   TQQQ: [92.7, 512.6], SGOV: [100.4, 88.2], 'BRK.B': [512.8, 9.6],
   LNG: [242.1, 12.4], STRC: [98.3, 640.1], KRAQ: [10.4, 1204.6]
}

const xstockListings = (params?: { wordCount?: number }): XStockListingsResponse => {
   const wordCount = params?.wordCount ?? 60
   return {
      wordCount,
      listings: xstockSeed.map((listing): XStockRow => {
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

let mockJob: MockJob | null = null

const mockStep = (ticker: string, group: number): XStockStep => ({
   ticker, group, phase: 'pending', activity: '', searches: [],
   startedAt: null, finishedAt: null, error: null
})

const startMockJob = (
   kind: XStockJobKind, tickers: string[], wordCount: number | null, groupSize: number
): XStockStartResponse => {

   const groups: string[][] = []
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

const snapshot = (): XStockJobResponse => ({ job: mockJob ? structuredClone(mockJob) : null })

const advanceMockJob = (): XStockJobResponse => {

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
         if (mockJob.kind === 'describe') storeMockDescription(step.ticker, mockJob.wordCount ?? 60)
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

const storeMockClassification = (ticker: string) => {
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

const mockDescriptionText: Record<string, string> = {
   AAPL: 'Designs and sells the iPhone, Mac, iPad and Apple Watch, and runs the services built around them — the App Store, iCloud, Apple Music and Apple Pay. Hardware is still the larger half of revenue, services the faster-growing one.',
   'BRK.B': 'Warren Buffett\'s holding company, built on insurance underwriting at GEICO and Berkshire Hathaway Reinsurance and on wholly owned operating businesses such as BNSF Railway and Berkshire Hathaway Energy, alongside a large listed equity portfolio.',
   LNG: 'Cheniere Energy runs the Sabine Pass and Corpus Christi terminals, the first to export liquefied natural gas from the United States mainland. Most capacity is contracted years ahead under long-term take-or-pay agreements.',
   NVDA: 'Designs the GPUs and networking behind most AI training and inference, sold as data-centre systems as much as chips, with the CUDA software stack as the moat around them. Also supplies gaming, robotics and automotive silicon.',
   STRC: 'A perpetual preferred share issued by Strategy Inc. It pays a variable dividend set by the board rather than a fixed coupon, ranks ahead of the common stock, and has no maturity date.',
   TSLA: 'Builds the Model 3, Y, S and X, the Cybertruck and Semi, plus grid-scale Megapack and home Powerwall storage. Revenue also comes from supercharging, insurance and the driver-assistance software sold per vehicle.',
   GLD: 'A trust that holds physical gold bullion in London vaults, one share tracking a fixed and slowly declining fraction of an ounce. It is a grantor trust rather than a fund, so it holds metal and nothing else.',
   SGOV: 'Holds US Treasury bills maturing within three months, rolled continuously. Duration is close to zero, so the price barely moves and almost all of the return arrives as monthly income tracking short-term rates.',
   SPY: 'The oldest US-listed ETF, tracking the S&P 500 as a unit investment trust. That structure means dividends are held in cash until they are paid out rather than reinvested, a small drag against newer S&P 500 funds.',
   TQQQ: 'Seeks three times the daily return of the Nasdaq-100 using swaps and futures. The leverage resets every day, so returns over longer periods compound away from 3x — volatility erodes them even when the index ends flat.',
   VOO: 'Vanguard\'s S&P 500 tracker, holding the index constituents at their market weights with one of the lowest expense ratios available. Structured as an open-ended fund, so dividends are reinvested rather than held in cash.'
}

const storeMockDescription = (ticker: string, wordCount: number) => {
   mockDescriptions.set(describedKey(ticker, wordCount), mockDescriptionText[ticker]
      ?? `A mocked ${wordCount}-word description for ${ticker}, written without contacting Anthropic, `
      + 'so it is filler rather than anything to read as fact.')
}

const xstockClassify = (params?: { tickers?: string[] }) =>
   startMockJob('classify', params?.tickers ?? [], null, 10)

const xstockDescribe = (params?: { tickers?: string[], wordCount?: number }) =>
   startMockJob('describe', params?.tickers ?? [], params?.wordCount ?? 60, 1)

const xstockJob = () => advanceMockJob()

const xstockJobCancel = (): XStockJobResponse => {
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
   tradingPairs, orderBatch, balances, assetRates, openOrders, cancelOrders,
   xstockListings, xstockClassify, xstockDescribe, xstockJob, xstockJobCancel
}
