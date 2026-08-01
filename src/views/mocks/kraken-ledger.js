import { tradeCount, orderCount, allTradeCount, clearTrades, restoreTrades } from './kraken-trades'

// Deterministic pseudo-random source, so the fixture is identical across reloads.
// The low bits of a linear congruential generator cycle far too quickly to be taken
// modulo anything — the lowest one alternates every draw, so `state % 10` came out
// even nine times out of ten and the rarer entry types never appeared. The draw is
// taken from the high bits instead.
function randomizer(seed) {
   let state = seed
   return (max) => {
      state = (state * 1103515245 + 12345) % 2147483648
      return Math.floor(state / 65536) % max
   }
}

const assets = [
   { asset: 'XXBT', baseAsset: 'BTC' },
   { asset: 'XETH', baseAsset: 'ETH' },
   { asset: 'DOT28.S', baseAsset: 'DOT' },
   { asset: 'ZUSD', baseAsset: 'USD' },
   { asset: 'SOL', baseAsset: 'SOL' }
]

function buildEntries() {

   const random = randomizer(20240801)
   const entries = []
   let time = Date.UTC(2023, 0, 12, 9, 30, 0)

   const push = entry => entries.push({ fee: '0.00000000', subtype: '', wallet: 'spot', ...entry })

   for (let i = 0; entries.length < 250; i++) {

      time += (4 + random(60)) * 3600000
      const roll = random(10)
      const { asset, baseAsset } = assets[random(assets.length)]
      const balance = (random(100000) / 100).toFixed(8)

      if (roll < 5) {
         // A trade writes one row per side of the pair, sharing a reference id.
         const refid = `TR${String(i).padStart(5, '0')}`
         const volume = (random(50000) / 1000000).toFixed(8)
         const cost = (random(500000) / 100).toFixed(4)

         push({ txid: `L${i}A`, refid, time, type: 'trade', asset, baseAsset,
            amount: volume, fee: (random(500) / 100000).toFixed(8), balance })
         push({ txid: `L${i}B`, refid, time, type: 'trade', asset: 'ZUSD', baseAsset: 'USD',
            amount: `-${cost}`, fee: (random(500) / 100).toFixed(4), balance: (random(500000) / 100).toFixed(4) })
      }
      else if (roll < 7) {
         push({ txid: `L${i}`, refid: `RW${i}`, time, type: 'earn', subtype: 'reward',
            asset, baseAsset, wallet: 'earn', amount: (random(20000) / 1000000).toFixed(8), balance })
      }
      else if (roll < 8) {
         push({ txid: `L${i}`, refid: `AL${i}`, time, type: 'earn', subtype: 'allocation',
            asset, baseAsset, wallet: 'earn', amount: (random(100000) / 10000).toFixed(8), balance })
      }
      else if (roll < 9) {
         // Kraken charges on some fiat funding methods, so deposits carry a fee too.
         push({ txid: `L${i}`, refid: `DP${i}`, time, type: 'deposit',
            asset: 'ZUSD', baseAsset: 'USD', amount: `${500 + random(4500)}.0000`,
            fee: (random(600) / 100).toFixed(4), balance })
      }
      else {
         push({ txid: `L${i}`, refid: `WD${i}`, time, type: 'withdrawal',
            asset, baseAsset, amount: `-${(random(30000) / 100000).toFixed(8)}`,
            fee: '0.00010000', balance })
      }
   }

   return entries.toSorted((a, b) => a.time - b.time)
}

let entries = buildEntries()
const allEntries = entries

let syncState = {
   apiKeyPrefix: 'MOCKKEY1',
   coveredFrom: entries[0].time,
   coveredTo: entries.at(-1).time,
   tradesCoveredFrom: entries[0].time,
   tradesCoveredTo: entries.at(-1).time,
   firstSyncedAt: Date.now() - 6 * 86400000,
   lastSyncedAt: Date.now() - 3600000,
   lastReportId: null,
   lastError: null,
   otherAccounts: []
}

// Phases are derived from elapsed time so that mocked mode drives the real polling
// loop and shows the whole progression rather than jumping straight to done. A run
// walks them twice, once per export report, as the server does.
const schedule = [
   [0, 'requesting', 'Queued', 'ledgers'],
   [1500, 'waiting', 'Processing', 'ledgers'],
   [7000, 'downloading', 'Processed', 'ledgers'],
   [8500, 'parsing', 'Processed', 'ledgers'],
   [9500, 'storing', 'Processed', 'ledgers'],
   [10500, 'requesting', 'Queued', 'trades'],
   [12000, 'waiting', 'Processing', 'trades'],
   [16000, 'downloading', 'Processed', 'trades'],
   [17000, 'parsing', 'Processed', 'trades'],
   [18000, 'storing', 'Processed', 'trades'],
   [19000, 'cleaning', 'Processed', 'trades'],
   [19500, 'done', 'Processed', 'trades']
]

const SYNC_MS = 19500

let job = null

function currentJob() {
   if (!job) return null

   const elapsed = Date.now() - job.startedAt
   if (job.cancelRequested) {
      return { ...job, phase: 'cancelled', finishedAt: job.startedAt + elapsed }
   }

   const [, phase, reportStatus, report] = schedule.findLast(([at]) => elapsed >= at) ?? schedule[0]

   // Counts belong to the report in flight, so they restart when the second one does.
   const rowCount = report === 'trades' ? allTradeCount() : allEntries.length
   const parsed = phase === 'requesting' || phase === 'waiting' ? 0 : rowCount

   return {
      ...job,
      phase,
      report,
      reportStatus,
      reportIds: { ledgers: job.reportId, trades: 'TCWJRA-9KLMN-QRSTU' },
      pollCount: Math.floor(elapsed / 1500),
      updatedAt: Date.now(),
      finishedAt: phase === 'done' ? job.startedAt + SYNC_MS : null,
      counts: {
         parsed,
         stored: ['storing', 'cleaning', 'done'].includes(phase) ? rowCount : 0,
         inserted: phase === 'done' ? (job.mode === 'full' ? 0 : 3) : 0,
         updated: phase === 'done' ? rowCount : 0,
         skipped: 0
      }
   }
}

export function ledgerSync(body) {
   const running = currentJob()
   if (running && !['done', 'error', 'cancelled'].includes(running.phase)) {
      return { job: running, alreadyRunning: true }
   }

   job = {
      accountId: 'mock-account',
      mode: body?.mode === 'full' ? 'full' : 'incremental',
      startedAt: Date.now(),
      reportId: 'TCWJRA-2JBAB-DHZE7X',
      requestedFrom: body?.mode === 'full' ? 0 : syncState.coveredTo - 72 * 3600000,
      error: null,
      cancelRequested: false
   }

   return { job: currentJob(), alreadyRunning: false }
}

export function ledgerSyncStatus() {
   const current = currentJob()

   // A sync after a clear puts the fixture back, so the mocked pages can be emptied
   // and refilled rather than staying blank for the rest of the session.
   if (current?.phase === 'done') {
      syncState = { ...syncState, lastSyncedAt: Date.now(), lastError: null }
      entries = allEntries
      restoreTrades()
   }

   return {
      job: current,
      state: {
         ...syncState,
         accountId: 'mock-account',
         entryCount: entries.length,
         tradeCount: tradeCount(),
         orderCount: orderCount(),
         dbSizeBytes: 1024 * 1024 * 3 + entries.length * 180 + tradeCount() * 220
      }
   }
}

export function ledgerSyncCancel() {
   if (job) job.cancelRequested = true
   return { job: currentJob() }
}

export function ledgerClear() {
   entries = []
   const trades = clearTrades()
   syncState = {
      ...syncState,
      coveredFrom: null, coveredTo: null,
      tradesCoveredFrom: null, tradesCoveredTo: null,
      lastSyncedAt: null, firstSyncedAt: null
   }
   job = null
   return { entries: allEntries.length, trades }
}

function applyFilters(filters = {}) {
   return entries.filter(entry =>
      (!filters.asset || entry.baseAsset === filters.asset)
      && (!filters.type || entry.type === filters.type)
      && (!filters.wallet || entry.wallet === filters.wallet)
      && (!filters.from || entry.time >= filters.from)
      && (!filters.to || entry.time <= filters.to)
      && (!filters.search
         || entry.txid.toLowerCase().includes(filters.search.toLowerCase())
         || entry.refid.toLowerCase().includes(filters.search.toLowerCase())))
}

// Filtering, sorting and paging are applied for real, so that mocked mode exercises
// the same code paths the server does rather than always returning the same page.
export function ledgerEntries(body = {}) {

   const filtered = applyFilters(body.filters)
   const column = ['time', 'amount', 'asset', 'type'].includes(body.sort?.column) ? body.sort.column : 'time'
   const factor = body.sort?.direction === 'asc' ? 1 : -1

   const value = entry => {
      if (column === 'amount') return Number(entry.amount)
      if (column === 'asset') return entry.baseAsset
      if (column === 'type') return entry.type
      return entry.time
   }

   const sorted = filtered.toSorted((a, b) => {
      const [left, right] = [value(a), value(b)]
      if (left < right) return -factor
      if (left > right) return factor
      return a.txid < b.txid ? -factor : factor
   })

   const page = Math.max(0, body.page ?? 0)
   const pageSize = body.pageSize ?? 50

   return { rows: sorted.slice(page * pageSize, (page + 1) * pageSize), total: filtered.length, page, pageSize }
}

// Mirrors LedgerRepository.feeSummary: same groupings, same shape, computed over the
// fixture so the page exercises its real rendering rather than a canned response.
export function ledgerFees(body = {}) {

   const charged = applyFilters(body.filters).filter(entry => Number(entry.fee) !== 0)

   const group = (keyOf) => {
      const groups = new Map()
      for (const entry of charged) {
         const key = keyOf(entry)
         const group = groups.get(key)
            ?? { total: 0, entries: 0, first: entry.time, last: entry.time }
         group.total += Number(entry.fee)
         group.entries += 1
         group.first = Math.min(group.first, entry.time)
         group.last = Math.max(group.last, entry.time)
         groups.set(key, group)
      }
      return groups
   }

   const monthOf = entry => new Date(entry.time).toISOString().slice(0, 7)

   const assets = [...group(entry => entry.baseAsset)]
      .map(([asset, group]) => ({ asset, ...group }))
      .toSorted((a, b) => b.entries - a.entries || a.asset.localeCompare(b.asset))

   const byType = [...group(entry => `${entry.baseAsset}|${entry.type}`)]
      .map(([key, group]) => ({ asset: key.split('|')[0], type: key.split('|')[1], total: group.total, entries: group.entries }))
      .toSorted((a, b) => b.entries - a.entries)

   const byMonth = [...group(entry => `${monthOf(entry)}|${entry.baseAsset}|${entry.type}`)]
      .map(([key, group]) => {
         const [month, asset, type] = key.split('|')
         return { month, asset, type, total: group.total, entries: group.entries }
      })
      .toSorted((a, b) => a.month.localeCompare(b.month))

   // Ranked per asset, like the SQL window function does.
   const largest = assets.flatMap(({ asset }) => charged
      .filter(entry => entry.baseAsset === asset)
      .toSorted((a, b) => Number(b.fee) - Number(a.fee))
      .slice(0, 10))

   return {
      assets,
      byType,
      byMonth,
      largest,
      entries: charged.length,
      first: charged.length > 0 ? Math.min(...charged.map(entry => entry.time)) : null,
      last: charged.length > 0 ? Math.max(...charged.map(entry => entry.time)) : null
   }
}

export function ledgerFilters() {
   const distinct = pick => [...new Set(entries.map(pick))].filter(Boolean).toSorted()
   return {
      assets: distinct(entry => entry.baseAsset),
      types: distinct(entry => entry.type),
      wallets: distinct(entry => entry.wallet)
   }
}
