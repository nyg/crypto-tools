import Big from 'big.js'
import { unzipSync } from 'fflate'
import * as resource from './resource'
import { normalizeAsset } from './assets'
import { buildPairIndex, resolvePair } from './pairs'
import { parseCsv, parseCsvTime } from './csv'

// Amounts are kept as the exact strings Kraken wrote. Reading them through Big and
// back would rewrite small values in exponential notation (1e-8), which is awkward
// to store and to compare.
const decimalPattern = /^-?\d+(\.\d+)?$/

// Returns null for anything that isn't a plain decimal, so the caller can drop the
// row rather than let Big throw on it later. An empty cell counts as zero.
const asDecimalString = value => {
   const trimmed = (value ?? '').trim()
   if (trimmed === '') return '0'
   return decimalPattern.test(trimmed) ? trimmed : null
}

// The running balance is informational, so an empty or malformed cell is stored as
// unknown rather than being read as a real zero or dropping the whole row.
const asOptionalDecimalString = value => {
   const trimmed = (value ?? '').trim()
   return decimalPattern.test(trimmed) ? trimmed : ''
}

export default function KrakenAPI(credentials) {

   this.fetchTradingPairs = async function () {
      const assetPairs = (await resource.fetchAssetPairs()).result
      return Object.keys(assetPairs)
         .map(pairId => ({
            id: assetPairs[pairId].altname,
            name: assetPairs[pairId].wsname,
            base: {
               name: assetPairs[pairId].base,
               decimals: assetPairs[pairId].lot_decimals,
            },
            quote: {
               name: assetPairs[pairId].quote,
               decimals: assetPairs[pairId].cost_decimals,
            }
         }))
         .reduce((pairs, pair) => {
            pairs[pair.id] = pair
            return pairs
         }, {})
   }

   this.createOrders = async function ({ orders, ...args }) {

      // maximum number of orders that can be created per API call
      const maxOrderCount = 15

      const orderChunks = []
      for (let i = 0; i < orders.length; i += maxOrderCount) {
         orderChunks.push(orders.slice(i, i + maxOrderCount))
      }

      const responses = []
      for (const orderChunk of orderChunks) {
         const response = await resource.createOrderBatch(credentials, { ...args, orders: orderChunk })
         responses.push(response)

         if (orderChunk !== orderChunks[orderChunks.length - 1]) {
            await new Promise(resolve => setTimeout(resolve, 2000))
         }
      }

      return responses.flatMap(response => response.result.orders)
   }

   // Every pair Kraken lists, keyed by each of the names the exports use for it.
   this.fetchPairIndex = async function () {
      const assetPairs = (await resource.fetchAllAssetPairs()).result
      return buildPairIndex(assetPairs)
   }

   // The total Kraken holds per asset, and how much of it is reserved by open orders.
   //
   // Deliberately not split by placement, even though BalanceEx does key earn positions
   // separately and does so accurately — checked against a real response, its suffixed
   // balances match the ledger's per-wallet amounts to the last digit. Two reasons the
   // breakdown is still read from the ledger:
   //
   //  - The suffix does not name the wallet, and the names it does carry are Kraken's
   //    product vocabulary rather than the one its own Earn screen shows: .S is
   //    "staked" but sits in the bonded wallet, .M is "opt-in rewards" but is the
   //    flexible one, .B is "new yield-bearing products" but is the locked one. The
   //    letters are also not stable — a position keyed XBT.F in mid-2025 is XBT.M now.
   //  - An opted-in holding has no suffix at all. Kraken pays those rewards onto the spot
   //    balance, so an asset earning that way is indistinguishable here from one that
   //    is doing nothing. The ledger's reward entries are the only way to tell.
   //
   // This answers "how much, in total, and how much of it is spoken for"; where each
   // coin sits is the ledger's question.
   this.fetchLiveBalances = async function () {

      const response = await resource.fetchExtendedBalance(credentials)

      const totals = new Map()

      for (const [asset, entry] of Object.entries(response.result ?? {})) {

         const normalizedAsset = normalizeAsset(asset)
         const held = Big(entry.balance ?? 0)
         const hold = Big(entry.hold_trade ?? 0)

         if (held.add(hold).eq(0)) continue

         const total = totals.get(normalizedAsset) ?? { total: Big(0), hold: Big(0) }
         // Kraken reports hold_trade as part of the balance, not on top of it.
         totals.set(normalizedAsset, { total: total.total.add(held), hold: total.hold.add(hold) })
      }

      return [...totals.entries()]
         .map(([asset, { total, hold }]) => ({
            asset,
            total: total.toFixed(),
            totalNum: Number(total),
            hold: hold.toFixed(),
            holdNum: Number(hold)
         }))
         .toSorted((a, b) => a.asset.localeCompare(b.asset))
   }

   // The orders behind the hold above, so that a balance that looks short can be
   // explained rather than just flagged.
   this.fetchOpenOrders = async function () {

      const response = await resource.fetchOpenOrders(credentials)
      const orders = Object.entries(response.result?.open ?? {})
      if (orders.length === 0) return []

      // Resolved through the same index the trade sync uses, so an open order reads
      // with the names the rest of the app shows (XXBTZUSD becomes BTC/USD).
      const pairIndex = await this.fetchPairIndex()

      return orders
         .map(([txid, order]) => ({
            txid,
            ...resolvePair(order.descr?.pair, pairIndex),
            type: order.descr?.type ?? '',
            ordertype: order.descr?.ordertype ?? '',
            price: order.descr?.price ?? '0',
            volume: order.vol ?? '0',
            executed: order.vol_exec ?? '0',
            opened: Math.round((order.opentm ?? 0) * 1000)
         }))
         .toSorted((a, b) => b.opened - a.opened)
   }

   // What one unit of each asset is worth in USD right now, for the assets asked for.
   // The USD pair is looked up rather than spelled out: Kraken quotes BTC as XBTUSD and
   // DOGE as XDGUSD, and the ticker answers under yet another name (XXBTZUSD), so both
   // directions go through the same normalized asset names the ledger is stored with.
   this.fetchUsdRates = async function (assets) {

      const wanted = new Set(assets.filter(asset => asset && asset !== 'USD'))
      const rates = { USD: 1 }
      if (wanted.size === 0) return rates

      const assetPairs = (await resource.fetchAllAssetPairs()).result
      const pairIndex = buildPairIndex(assetPairs)

      const altnames = new Map()
      for (const pair of Object.values(assetPairs ?? {})) {
         // Darkpool pairs (XBT/USD.d) quote the same asset but trade separately, and
         // an offline pair has no meaningful last trade.
         if (!pair.altname || pair.altname.includes('.')) continue
         if (pair.status && pair.status !== 'online') continue
         // Matched exactly rather than through normalizeAsset, which strips the digit
         // off Kraken's USD1 stablecoin and would let the thin ETHUSD1 book stand in
         // for ETHUSD.
         if (!['USD', 'ZUSD'].includes(pair.quote)) continue

         const baseAsset = normalizeAsset(pair.base)
         if (wanted.has(baseAsset) && !altnames.has(baseAsset)) {
            altnames.set(baseAsset, pair.altname)
         }
      }

      if (altnames.size === 0) return rates

      // Assets Kraken has no USD pair for are left out rather than valued at zero, so
      // the page can tell "not traded here" apart from "worth nothing".
      const ticker = (await resource.fetchTicker([...altnames.values()])).result ?? {}
      for (const [name, entry] of Object.entries(ticker)) {
         const { baseAsset } = resolvePair(name, pairIndex)
         const price = Number(entry?.c?.[0])
         if (wanted.has(baseAsset) && Number.isFinite(price)) {
            rates[baseAsset] = price
         }
      }

      return rates
   }

   this.fetchAssets = async function (type) {
      const response = await resource.fetchAssetInfo(type)
      return response.result
   }

   this.fetchTokenizedListings = async function () {
      const assets = await this.fetchAssets('tokenized_asset')
      return [...new Map(Object.values(assets)
         .filter(asset => asset.status === 'enabled' && asset.altname)
         .map(asset => [asset.altname, {
            altname: asset.altname,
            ticker: asset.altname.replace(/x$/, '')
         }])).values()]
         .sort((a, b) => a.ticker.localeCompare(b.ticker))
   }

   /* Export reports — 'ledgers' and 'trades' share this machinery */

   this.requestExport = async function ({ report, description, fromDate, toDate }) {
      const response = await resource.addExport(credentials, { report, description, fromDate, toDate })
      return response.result.id
   }

   this.fetchExportReports = async function (report = 'ledgers') {
      const response = await resource.fetchExportStatus(credentials, report)
      return (response.result ?? []).map(entry => ({
         id: entry.id,
         description: entry.descr,
         status: entry.status,
         createdDate: Number(entry.createdtm) * 1000,
         completedDate: Number(entry.completedtm) * 1000
      }))
   }

   this.removeExport = async function (reportId, type = 'delete') {
      await resource.removeExport(credentials, { reportId, type })
   }

   // Downloads a prepared report and returns its rows. Kraken answers with a zip
   // holding a single CSV, whichever report was asked for.
   const readExportRows = async function (reportId) {

      const archive = await resource.retrieveExport(credentials, { reportId })

      if (archive[0] !== 0x50 || archive[1] !== 0x4b) {
         throw new Error('Kraken returned an unexpected export payload (not a zip archive).')
      }

      const files = unzipSync(archive)
      const fileName = Object.keys(files)[0]
      if (!fileName) {
         throw new Error('The Kraken export archive was empty.')
      }

      console.log('Reading export entry:', fileName)
      return parseCsv(new TextDecoder().decode(files[fileName]))
   }

   this.fetchLedgerEntries = async function (reportId) {

      const rows = await readExportRows(reportId)

      const entries = []
      let skipped = 0

      for (const row of rows) {
         const time = parseCsvTime(row.time)
         const amount = asDecimalString(row.amount)
         const fee = asDecimalString(row.fee)

         // A row without a usable time or amount cannot be stored or summed.
         if (Number.isNaN(time) || amount === null || fee === null) {
            skipped++
            continue
         }

         entries.push({
            txid: row.txid ?? '',
            refid: row.refid ?? '',
            time,
            type: row.type ?? '',
            subtype: row.subtype ?? '',
            aclass: row.aclass ?? '',
            asset: row.asset ?? '',
            baseAsset: normalizeAsset(row.asset),
            wallet: row.wallet ?? '',
            amount,
            fee,
            balance: asOptionalDecimalString(row.balance)
         })
      }

      return { entries, skipped }
   }

   // The trades report is what carries the order id: the ledger export has none, and
   // a trade's txid here is the refid its two ledger entries already share.
   this.fetchTradeEntries = async function (reportId, pairIndex) {

      const rows = await readExportRows(reportId)

      const trades = []
      let skipped = 0

      for (const row of rows) {
         const time = parseCsvTime(row.time)
         const price = asDecimalString(row.price)
         const cost = asDecimalString(row.cost)
         const fee = asDecimalString(row.fee)
         const vol = asDecimalString(row.vol)

         // Without a txid the row cannot be keyed, and without usable amounts it
         // cannot be summed into an order.
         if (!row.txid || Number.isNaN(time) || [price, cost, fee, vol].includes(null)) {
            skipped++
            continue
         }

         const { baseAsset, quoteAsset, pairKey } = resolvePair(row.pair, pairIndex)

         trades.push({
            txid: row.txid,
            ordertxid: row.ordertxid ?? '',
            // Kraken occasionally writes a trade with no order id. Grouping on the
            // bare column would collapse every one of them into a single phantom
            // order, so they stand alone under their own trade id instead.
            orderKey: row.ordertxid || row.txid,
            pair: row.pair ?? '',
            pairKey,
            baseAsset,
            quoteAsset,
            time,
            type: row.type ?? '',
            ordertype: row.ordertype ?? '',
            price,
            cost,
            fee,
            vol,
            margin: asDecimalString(row.margin) ?? '0',
            misc: row.misc ?? ''
         })
      }

      return { trades, skipped }
   }
}
