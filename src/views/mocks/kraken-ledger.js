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

const DAY = 86400000

function lastCompletePeriods(now = Date.now()) {

   const today = new Date(now)
   const [year, month, day] = [today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()]

   const thisWeek = Date.UTC(year, month, day) - ((today.getUTCDay() + 6) % 7) * DAY
   const thisMonth = Date.UTC(year, month, 1)

   return {
      week: { from: thisWeek - 7 * DAY, to: thisWeek - 1 },
      month: { from: Date.UTC(year, month - 1, 1), to: thisMonth - 1 }
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
   let time = Date.now() - 1250 * DAY

   // Wallets are spelled the way Kraken spells them in the export, because the Balances
   // page reads the placement of a holding out of exactly this string.
   const push = entry => entries.push({ fee: '0.00000000', subtype: '', wallet: 'spot / main', ...entry })

   for (let i = 0; entries.length < 250; i++) {

      time += (24 + random(300)) * 3600000
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
            asset, baseAsset, wallet: 'earn / flexible', amount: (random(20000) / 1000000).toFixed(8), balance })
      }
      else if (roll < 8) {
         push({ txid: `L${i}`, refid: `AL${i}`, time, type: 'earn', subtype: 'allocation',
            asset, baseAsset, wallet: 'earn / flexible', amount: (random(100000) / 10000).toFixed(8), balance })
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

   // A tail of deterministic entries, so that every placement the Balances page can draw
   // is present whatever the random draw did: a coin in each earn wallet, a spot holding
   // still being paid (Opt-In Rewards), a position carrying a retired staking name alongside
   // its current one, and one worth too little to be worth a row.
   const recently = days => Date.now() - days * 86400000

   // Opening deposits, so the random withdrawals above cannot take a spot wallet
   // negative — a holding below zero is not a case the page needs to show.
   push({ txid: 'LBTC0', refid: 'DPBTC', time: recently(700), type: 'deposit',
      asset: 'XXBT', baseAsset: 'BTC', amount: '2.50000000', balance: '2.50000000' })
   push({ txid: 'LETH0', refid: 'DPETH', time: recently(700), type: 'deposit',
      asset: 'XETH', baseAsset: 'ETH', amount: '6.00000000', balance: '6.00000000' })
   push({ txid: 'LSOL0', refid: 'DPSOL', time: recently(700), type: 'deposit',
      asset: 'SOL', baseAsset: 'SOL', amount: '12.00000000', balance: '12.00000000' })

   push({ txid: 'LDOT1', refid: 'DPDOT', time: recently(120), type: 'deposit',
      asset: 'DOT', baseAsset: 'DOT', amount: '1200.00000000', balance: '1200.00000000' })
   push({ txid: 'LDOT2', refid: 'RWDOT', time: recently(2), type: 'earn', subtype: 'reward',
      asset: 'DOT', baseAsset: 'DOT', amount: '0.84210000', balance: '1200.84210000' })

   push({ txid: 'LETH1', refid: 'ALETH', time: recently(300), type: 'earn', subtype: 'allocation',
      asset: 'ETH2.S', baseAsset: 'ETH', wallet: 'earn / liquid', amount: '4.50000000', balance: '4.50000000' })
   push({ txid: 'LETH2', refid: 'RWETH', time: recently(3), type: 'earn', subtype: 'reward',
      asset: 'ETH2.S', baseAsset: 'ETH', wallet: 'earn / liquid', amount: '0.01120000', balance: '4.51120000' })

   push({ txid: 'LBTC1', refid: 'ALBTC', time: recently(90), type: 'earn', subtype: 'allocation',
      asset: 'XXBT', baseAsset: 'BTC', wallet: 'earn / flexible', amount: '0.35000000', balance: '0.35000000' })
   push({ txid: 'LBTC2', refid: 'RWBTC', time: recently(5), type: 'earn', subtype: 'reward',
      asset: 'XXBT', baseAsset: 'BTC', wallet: 'earn / flexible', amount: '0.00042000', balance: '0.35042000' })

   push({ txid: 'LSOL1', refid: 'ALSOL', time: recently(200), type: 'earn', subtype: 'allocation',
      asset: 'SOL', baseAsset: 'SOL', wallet: 'earn / bonded', amount: '38.00000000', balance: '38.00000000' })
   push({ txid: 'LSOL2', refid: 'RWSOL', time: recently(4), type: 'earn', subtype: 'reward',
      asset: 'SOL', baseAsset: 'SOL', wallet: 'earn / bonded', amount: '0.19000000', balance: '38.19000000' })

   push({ txid: 'LADA1', refid: 'ALADA', time: recently(400), type: 'earn', subtype: 'allocation',
      asset: 'ADA', baseAsset: 'ADA', wallet: 'earn / locked', amount: '9000.00000000', balance: '9000.00000000' })
   push({ txid: 'LADA2', refid: 'RWADA', time: recently(6), type: 'earn', subtype: 'reward',
      asset: 'ADA', baseAsset: 'ADA', wallet: 'earn / locked', amount: '12.40000000', balance: '9012.40000000' })

   const { week, month } = lastCompletePeriods()
   const midWeek = week.from + 3 * DAY
   const midMonth = month.from + Math.floor((month.to - month.from) / 2)

   push({ txid: 'LBTC3', refid: 'RWBTCW', time: midWeek, type: 'earn', subtype: 'reward',
      asset: 'XXBT', baseAsset: 'BTC', wallet: 'earn / flexible', amount: '0.00038000', balance: '0.35080000' })
   push({ txid: 'LSOL3', refid: 'RWSOLW', time: midWeek + DAY, type: 'earn', subtype: 'reward',
      asset: 'SOL', baseAsset: 'SOL', wallet: 'earn / bonded', amount: '0.16500000', balance: '38.35500000' })

   push({ txid: 'LADA4', refid: 'RWADAM', time: midMonth, type: 'earn', subtype: 'reward',
      asset: 'ADA', baseAsset: 'ADA', wallet: 'earn / locked', amount: '11.80000000', balance: '9024.20000000' })
   push({ txid: 'LETH3', refid: 'RWETHM', time: midMonth + DAY, type: 'earn', subtype: 'reward',
      asset: 'ETH2.S', baseAsset: 'ETH', wallet: 'earn / liquid', amount: '0.00980000', balance: '4.52100000' })

   // Staked under the name Kraken has since retired, and never opted back in, so it
   // reads as an idle spot holding with two raw names behind it.
   push({ txid: 'LADA3', refid: 'STADA', time: recently(1100), type: 'staking',
      asset: 'ADA.S', baseAsset: 'ADA', amount: '640.00000000', balance: '640.00000000' })

   push({ txid: 'LLINK1', refid: 'DPLINK', time: recently(500), type: 'deposit',
      asset: 'LINK', baseAsset: 'LINK', amount: '0.02400000', balance: '0.02400000' })

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
// loop and shows the whole progression rather than jumping straight to done. One step
// walks these; the run walks the steps one after the other, as the server does.
const stepSchedule = [
   [0, 'requesting', null],
   [1500, 'waiting', 'Queued'],
   [3000, 'waiting', 'Processing'],
   [7000, 'downloading', 'Processed'],
   [8500, 'parsing', 'Processed'],
   [9500, 'storing', 'Processed'],
   [10000, 'cleaning', 'Processed'],
   [10500, 'done', 'Processed']
]

const STEP_MS = 10500
const SYNC_MS = 2 * STEP_MS

const reportIds = { ledgers: 'TCWJRA-2JBAB-DHZE7X', trades: 'TCWJRA-9KLMN-QRSTU' }

let job = null

// The step's own view of the run: `offset` is when its turn starts, so everything
// before that reads as pending and everything after as finished.
function stepAt(report, elapsed, offset, mode) {

   const rowCount = report === 'trades' ? allTradeCount() : allEntries.length
   const local = elapsed - offset

   const base = {
      report,
      reportId: local >= 0 ? reportIds[report] : null,
      reportStatus: null,
      reportRemoved: false,
      requestedFrom: null,
      startedAt: local >= 0 ? job.startedAt + offset : null,
      finishedAt: null,
      pollCount: 0,
      counts: { parsed: 0, stored: 0, inserted: 0, updated: 0, skipped: 0 },
      error: null
   }

   if (local < 0) return { ...base, phase: 'pending' }

   const [, phase, reportStatus] = stepSchedule.findLast(([at]) => local >= at) ?? stepSchedule[0]
   const stored = ['storing', 'cleaning', 'done'].includes(phase)

   return {
      ...base,
      phase,
      reportStatus,
      reportRemoved: phase === 'done',
      pollCount: Math.floor(Math.min(local, 7000) / 1500),
      finishedAt: phase === 'done' ? job.startedAt + offset + STEP_MS : null,
      counts: {
         parsed: ['requesting', 'waiting'].includes(phase) ? 0 : rowCount,
         stored: stored ? rowCount : 0,
         inserted: phase === 'done' ? (mode === 'full' ? 0 : 3) : 0,
         updated: phase === 'done' ? rowCount - (mode === 'full' ? 0 : 3) : 0,
         skipped: 0
      }
   }
}

function currentJob() {
   if (!job) return null

   const elapsed = Date.now() - job.startedAt
   const steps = ['ledgers', 'trades']
      .map((report, index) => stepAt(report, elapsed, index * STEP_MS, job.mode))

   if (job.cancelRequested) {
      return {
         ...job,
         phase: 'cancelled',
         updatedAt: Date.now(),
         finishedAt: job.startedAt + elapsed,
         // Whichever step was in flight was cancelled with the run; one that never
         // started was dropped, exactly as the server records it.
         steps: steps.map(step => step.phase === 'done'
            ? step
            : { ...step, phase: step.phase === 'pending' ? 'skipped' : 'cancelled' })
      }
   }

   return {
      ...job,
      phase: elapsed >= SYNC_MS ? 'done' : 'running',
      steps,
      updatedAt: Date.now(),
      finishedAt: elapsed >= SYNC_MS ? job.startedAt + SYNC_MS : null
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
         const group = groups.get(key) ?? { total: 0, entries: 0 }
         group.total += Number(entry.fee)
         group.entries += 1
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

   return { assets, byType, byMonth, entries: charged.length }
}

// Mirrors LedgerRepository.rewardSummary: the same reward predicate and the same pivot,
// computed over the fixture.
export function ledgerRewards() {

   const excludedSubtypes = ['allocation', 'deallocation', 'autoallocation', 'migration']
   const rewards = entries.filter(entry =>
      ['staking', 'earn'].includes(entry.type) && !excludedSubtypes.includes(entry.subtype))

   const assets = new Map()

   for (const entry of rewards) {
      const year = new Date(entry.time).getUTCFullYear()
      const amount = Number(entry.amount) - Number(entry.fee)

      const asset = assets.get(entry.baseAsset)
         ?? { asset: entry.baseAsset, total: 0, entries: 0, first: entry.time, last: entry.time, byYear: {} }

      asset.byYear[year] = (asset.byYear[year] ?? 0) + amount
      asset.total += amount
      asset.entries += 1
      asset.first = Math.min(asset.first, entry.time)
      asset.last = Math.max(asset.last, entry.time)
      assets.set(entry.baseAsset, asset)
   }

   const years = [...new Set([...assets.values()].flatMap(asset => Object.keys(asset.byYear).map(Number)))]
      .toSorted((a, b) => a - b)

   const periodAssets = (from, to) => {

      const totals = new Map()

      for (const entry of rewards.filter(entry => entry.time >= from && entry.time <= to)) {
         const total = totals.get(entry.baseAsset) ?? { asset: entry.baseAsset, total: 0, entries: 0 }
         total.total += Number(entry.amount) - Number(entry.fee)
         total.entries += 1
         totals.set(entry.baseAsset, total)
      }

      return [...totals.values()].toSorted((a, b) => a.asset.localeCompare(b.asset))
   }

   const periods = Object.fromEntries(Object.entries(lastCompletePeriods())
      .map(([name, { from, to }]) => [name, { from, to, assets: periodAssets(from, to) }]))

   return {
      years,
      periods,
      assets: [...assets.values()].toSorted((a, b) => a.asset.localeCompare(b.asset)),
      entries: rewards.length,
      first: rewards.length > 0 ? Math.min(...rewards.map(entry => entry.time)) : null,
      last: rewards.length > 0 ? Math.max(...rewards.map(entry => entry.time)) : null
   }
}

// Mirrors LedgerRepository.balanceSummary: the same fold of amount - fee per asset and
// wallet, over the same fixture, so that clearing and re-syncing empties and refills
// the Balances page the way it does every other one.
export function ledgerBalances() {

   const excludedSubtypes = ['allocation', 'deallocation', 'autoallocation', 'migration']
   const positions = new Map()

   for (const entry of entries) {

      const key = `${entry.baseAsset} ${entry.wallet}`
      const position = positions.get(key)
         ?? {
            asset: entry.baseAsset, wallet: entry.wallet, amount: 0, rawAssets: new Set(),
            entries: 0, first: entry.time, last: entry.time, lastRewardAt: null, rewardEntries: 0
         }

      position.amount += Number(entry.amount) - Number(entry.fee)
      position.rawAssets.add(entry.asset)
      position.entries += 1
      position.first = Math.min(position.first, entry.time)
      position.last = Math.max(position.last, entry.time)

      if (['staking', 'earn'].includes(entry.type) && !excludedSubtypes.includes(entry.subtype)) {
         position.lastRewardAt = Math.max(position.lastRewardAt ?? 0, entry.time)
         position.rewardEntries += 1
      }

      positions.set(key, position)
   }

   const assets = new Map()

   for (const position of positions.values()) {

      // Rounded to the precision Kraken writes: the fixture adds floats, and a total of
      // -3e-17 would otherwise pass for a holding.
      const amount = Number(position.amount.toFixed(8))
      if (amount === 0) continue

      const asset = assets.get(position.asset) ?? { asset: position.asset, total: 0, positions: [] }

      asset.total += amount
      asset.positions.push({
         wallet: position.wallet,
         amount: amount.toFixed(8),
         amountNum: amount,
         rawAssets: [...position.rawAssets].toSorted(),
         entries: position.entries,
         first: position.first,
         last: position.last,
         lastRewardAt: position.lastRewardAt,
         rewardEntries: position.rewardEntries
      })
      assets.set(position.asset, asset)
   }

   const held = [...assets.values()]

   return {
      assets: held.map(asset => ({
         asset: asset.asset,
         total: asset.total.toFixed(8),
         totalNum: asset.total,
         positions: asset.positions.toSorted((a, b) => b.amountNum - a.amountNum)
      })),
      positions: held.reduce((count, asset) => count + asset.positions.length, 0),
      entries: entries.length,
      first: entries.length > 0 ? entries[0].time : null,
      last: entries.length > 0 ? entries.at(-1).time : null
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
