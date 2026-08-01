// Deterministic pseudo-random source, so the fixture is identical across reloads.
function randomizer(seed) {
   let state = seed
   return (max) => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state % max
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
         push({ txid: `L${i}`, refid: `DP${i}`, time, type: 'deposit',
            asset: 'ZUSD', baseAsset: 'USD', amount: `${500 + random(4500)}.0000`, balance })
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
   firstSyncedAt: Date.now() - 6 * 86400000,
   lastSyncedAt: Date.now() - 3600000,
   lastReportId: null,
   lastError: null,
   otherAccounts: []
}

// Phases are derived from elapsed time so that mocked mode drives the real polling
// loop and shows the whole progression rather than jumping straight to done.
const schedule = [
   [0, 'requesting', 'Queued'],
   [1500, 'waiting', 'Processing'],
   [7000, 'downloading', 'Processed'],
   [8500, 'parsing', 'Processed'],
   [9500, 'storing', 'Processed'],
   [10500, 'cleaning', 'Processed'],
   [11000, 'done', 'Processed']
]

let job = null

function currentJob() {
   if (!job) return null

   const elapsed = Date.now() - job.startedAt
   if (job.cancelRequested) {
      return { ...job, phase: 'cancelled', finishedAt: job.startedAt + elapsed }
   }

   const [, phase, reportStatus] = schedule.findLast(([at]) => elapsed >= at) ?? schedule[0]
   const parsed = phase === 'requesting' || phase === 'waiting' ? 0 : allEntries.length

   return {
      ...job,
      phase,
      reportStatus,
      pollCount: Math.floor(elapsed / 1500),
      updatedAt: Date.now(),
      finishedAt: phase === 'done' ? job.startedAt + 11000 : null,
      counts: {
         parsed,
         stored: ['storing', 'cleaning', 'done'].includes(phase) ? allEntries.length : 0,
         inserted: phase === 'done' ? (job.mode === 'full' ? 0 : 3) : 0,
         updated: phase === 'done' ? allEntries.length : 0,
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

   if (current?.phase === 'done') {
      syncState = { ...syncState, lastSyncedAt: Date.now(), lastError: null }
   }

   return {
      job: current,
      state: {
         ...syncState,
         accountId: 'mock-account',
         entryCount: entries.length,
         dbSizeBytes: 1024 * 1024 * 3 + entries.length * 180
      }
   }
}

export function ledgerSyncCancel() {
   if (job) job.cancelRequested = true
   return { job: currentJob() }
}

export function ledgerClear() {
   entries = []
   syncState = { ...syncState, coveredFrom: null, coveredTo: null, lastSyncedAt: null, firstSyncedAt: null }
   job = null
   return { deleted: allEntries.length }
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

export function ledgerFilters() {
   const distinct = pick => [...new Set(entries.map(pick))].filter(Boolean).toSorted()
   return {
      assets: distinct(entry => entry.baseAsset),
      types: distinct(entry => entry.type),
      wallets: distinct(entry => entry.wallet)
   }
}
