import Big from 'big.js'
import * as resource from './resource'


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
            await new Promise(resolve => setTimeout(resolve, 2000));
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
               volume: orders.result.closed[orderId].vol_exec,
               cost: orders.result.closed[orderId].cost,
               price: orders.result.closed[orderId].price,
               openedDate: orders.result.closed[orderId].opentm,
               closedDate: orders.result.closed[orderId].closetm
            }))

         allOrders.push(...filteredOrders)
      }

      return allOrders.toSorted((a, b) => a.openedDate - b.openedDate)
   }

   this.fetchBalances = async function () {

      const response = await resource.fetchExtendedBalance(credentials)

      return Object.keys(response.result)
         .reduce((balances, asset) => {

            const parachainMatch = asset.match(/(?<asset>[A-Z]+)\.P/)
            const earningMatch = asset.match(/(?<asset>[A-Z]+)\.S/)
            const stakingMatch = asset.match(/(?<asset>[A-Z]+)[0-9]+\.S/)
            const commodityMatch = asset.match(/^X(?<asset>[A-Z]{3})$/)
            const fiatMatch = asset.match(/^Z(?<asset>[A-Z]{3})$/)

            if (parachainMatch) {
               balances[parachainMatch.groups.asset] ??= {}
               balances[parachainMatch.groups.asset].parachain = Big(response.result[asset].balance)
            }
            else if (earningMatch) {
               balances[earningMatch.groups.asset] ??= {}
               balances[earningMatch.groups.asset].earning = Big(response.result[asset].balance)
            }
            else if (stakingMatch) {
               balances[stakingMatch.groups.asset] ??= {}
               balances[stakingMatch.groups.asset].staking = Big(response.result[asset].balance)
            }
            else if (commodityMatch) {
               balances[commodityMatch.groups.asset] ??= {}
               balances[commodityMatch.groups.asset].free = Big(response.result[asset].balance)
               balances[commodityMatch.groups.asset].trade = Big(response.result[asset].hold_trade)
            }
            else if (fiatMatch) {
               balances[fiatMatch.groups.asset] ??= {}
               balances[fiatMatch.groups.asset].free = Big(response.result[asset].balance)
               balances[fiatMatch.groups.asset].trade = Big(response.result[asset].hold_trade)
            }
            else if (asset === 'XBT') {
               balances.BTC ??= {}
               balances.BTC.free = Big(response.result[asset].balance)
               balances.BTC.trade = Big(response.result[asset].hold_trade)
            }
            else {
               balances[asset] ??= {}
               balances[asset].free = Big(response.result[asset].balance)
               balances[asset].trade = Big(response.result[asset].hold_trade)
            }

            return balances
         }, {})
   }
}
