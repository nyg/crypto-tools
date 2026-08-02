import Big from 'big.js'
import { unzipSync } from 'fflate'
import * as resource from './resource'
import { assetCategory, normalizeAsset } from './assets'
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

   this.fetchBalances = async function () {

      const response = await resource.fetchExtendedBalance(credentials)
      return Object.keys(response.result)
         .reduce((balances, asset) => {

            const normalizedAsset = normalizeAsset(asset)
            const category = assetCategory(asset)

            const freeBalance = Big(response.result[asset].balance)
            const holdTradeBalance = Big(response.result[asset].hold_trade)

            if (freeBalance.add(holdTradeBalance).eq(0)) {
               return balances
            }

            balances[normalizedAsset] ??= {}
            if (!freeBalance.eq(0)) {
               balances[normalizedAsset][category] = freeBalance.add(balances[normalizedAsset][category] ?? 0)
            }
            if (!holdTradeBalance.eq(0)) {
               balances[normalizedAsset].trade = holdTradeBalance.add(balances[normalizedAsset].trade ?? 0)
            }

            return balances
         }, {})
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
