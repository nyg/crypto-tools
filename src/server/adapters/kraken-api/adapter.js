import Big from 'big.js'
import { unzipSync } from 'fflate'
import * as resource from './resource'
import { assetCategory, normalizeAsset } from './assets'
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

   this.fetchClosedOrders = async function ({ assetFilter, fromDate, toDate }) {

      let hasNext = true, orderOffset = 0, fetchedOrderCount = 0
      const allOrders = []

      while (hasNext) {
         const orders = await resource.fetchClosedOrders(credentials, { showTrades: true, fromDate, toDate, orderOffset })
         const orderIds = Object.keys(orders.result.closed)

         fetchedOrderCount += orderIds.length
         hasNext = fetchedOrderCount < orders.result.count
         orderOffset += 50

         const filteredOrders = orderIds
            .filter(orderId => assetFilter ? orders.result.closed[orderId].descr.pair.includes(assetFilter) : true)
            .filter(orderId => Number.parseFloat(orders.result.closed[orderId].vol_exec) !== 0) // TODO
            .map(orderId => ({
               orderId,
               pair: orders.result.closed[orderId].descr.pair,
               direction: orders.result.closed[orderId].descr.type,
               volume: Big(orders.result.closed[orderId].vol_exec),
               cost: Big(orders.result.closed[orderId].cost),
               price: Big(orders.result.closed[orderId].price),
               fee: Big(orders.result.closed[orderId].fee),
               openedDate: orders.result.closed[orderId].opentm,
               closedDate: orders.result.closed[orderId].closetm,
               flags: orders.result.closed[orderId].oflags
            }))

         allOrders.push(...filteredOrders)
      }

      return allOrders.toSorted((a, b) => a.openedDate - b.openedDate)
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

   this.fetchAssets = async function (type) {
      const response = await resource.fetchAssetInfo(type)
      return response.result
   }

   /* Ledger export */

   this.requestLedgerExport = async function ({ description, fromDate, toDate }) {
      const response = await resource.addExport(credentials, { description, fromDate, toDate })
      return response.result.id
   }

   this.fetchExportReports = async function () {
      const response = await resource.fetchExportStatus(credentials)
      return (response.result ?? []).map(report => ({
         id: report.id,
         description: report.descr,
         status: report.status,
         createdDate: Number(report.createdtm) * 1000,
         completedDate: Number(report.completedtm) * 1000
      }))
   }

   this.removeExport = async function (reportId, type = 'delete') {
      await resource.removeExport(credentials, { reportId, type })
   }

   // Downloads the prepared report and turns it into ledger entries. Kraken answers
   // with a zip holding a single CSV.
   this.fetchLedgerEntries = async function (reportId) {

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
      const rows = parseCsv(new TextDecoder().decode(files[fileName]))

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
}
