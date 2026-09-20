import Big from 'big.js'
import {
   cancelOrder, createOrder, fetchApiKeyInfo, fetchExecutions, fetchOpenStopOrders,
   fetchOrderByLinkId, fetchSpotInstruments, fetchSpotTickers, fetchUnifiedWallet
} from './resource'
import { HttpRequesterError } from '../../errors'
import type { Credentials } from '../../../types/credentials'
import type { BybitEnvironment, BybitOrder } from '../../../types/bybit-api'
import type {
   ExchangeAccount, OpenStopOrder, OrderRequest, OrderSettlement, SettlementStatus, SpotMarket,
   SpotPrice, StopOrderRequest, WalletCoin
} from '../../../types/portfolio'

const openStatuses = ['New', 'PartiallyFilled', 'Untriggered', 'Created']

const goneCodes = [110001, 170213, 170145]

function alreadyGone(error: unknown): boolean {
   if (!(error instanceof HttpRequesterError)) return false
   const body = error.body as { retCode?: number } | undefined
   return goneCodes.includes(body?.retCode ?? -1)
}

function settlementStatus({ orderStatus, cumExecQty }: BybitOrder): SettlementStatus {
   if (openStatuses.includes(orderStatus)) return 'open'
   if (orderStatus === 'Filled') return 'filled'
   return Big(cumExecQty || 0).gt(0) ? 'partial' : 'rejected'
}

const nonZero = (fees: Record<string, string>) =>
   Object.fromEntries(Object.entries(fees).filter(([, amount]) => !Big(amount || 0).eq(0)))

export default class BybitAPI {

   readonly #environment: BybitEnvironment
   readonly #credentials: Credentials | undefined

   constructor(environment: BybitEnvironment, credentials?: Credentials) {
      this.#environment = environment
      this.#credentials = credentials
   }

   get #authenticated(): Credentials {
      if (!this.#credentials) throw new Error('This Bybit call needs API credentials.')
      return this.#credentials
   }

   async fetchSpotMarkets(): Promise<SpotMarket[]> {
      const instruments = await fetchSpotInstruments()
      return instruments
         .filter(({ status }) => status === 'Trading')
         .map(({ symbol, baseCoin, quoteCoin, lotSizeFilter, priceFilter }) => ({
            symbol,
            base: baseCoin,
            quote: quoteCoin,
            baseStep: lotSizeFilter.basePrecision,
            quoteStep: lotSizeFilter.quotePrecision,
            tickStep: priceFilter.tickSize,
            minQty: lotSizeFilter.minOrderQty,
            minAmount: lotSizeFilter.minOrderAmt,
            maxQty: lotSizeFilter.maxMarketOrderQty || lotSizeFilter.maxOrderQty,
            maxAmount: lotSizeFilter.maxOrderAmt
         }))
   }

   async fetchSpotPrices(): Promise<Record<string, SpotPrice>> {
      const tickers = await fetchSpotTickers()
      return Object.fromEntries(tickers.map(({ symbol, lastPrice, bid1Price, ask1Price }) =>
         [symbol, { last: lastPrice, bid: bid1Price || lastPrice, ask: ask1Price || lastPrice }]))
   }

   async fetchWallet(): Promise<WalletCoin[]> {
      const account = await fetchUnifiedWallet(this.#environment, this.#authenticated)
      return (account?.coin ?? []).map(({ coin, walletBalance, locked, spotBorrow }) => ({
         asset: coin,
         total: walletBalance || '0',
         free: Big(walletBalance || 0).minus(locked || 0).toFixed(),
         borrowed: spotBorrow || '0'
      }))
   }

   async fetchAccount(): Promise<ExchangeAccount> {
      const { readOnly, permissions, expiredAt, userID, userIDInt64 } =
         await fetchApiKeyInfo(this.#environment, this.#authenticated)

      const expiresAt = Date.parse(expiredAt)

      return {
         accountId: userIDInt64 && userIDInt64 !== '0' ? userIDInt64 : String(userID),
         canTrade: readOnly === 0 && (permissions.Spot ?? []).includes('SpotTrade'),
         expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null
      }
   }

   async placeMarketOrder({ clientOrderId, symbol, side, unit, amount, maxSlippagePercent }: OrderRequest): Promise<string> {
      const { orderId } = await createOrder(this.#environment, this.#authenticated, {
         category: 'spot',
         symbol,
         side: side === 'buy' ? 'Buy' : 'Sell',
         orderType: 'Market',
         qty: amount,
         marketUnit: unit === 'base' ? 'baseCoin' : 'quoteCoin',
         isLeverage: 0,
         orderLinkId: clientOrderId,
         slippageToleranceType: 'Percent',
         slippageTolerance: maxSlippagePercent
      })
      return orderId
   }

   async placeStopOrder({ clientOrderId, symbol, quantity, triggerPrice }: StopOrderRequest): Promise<string> {
      const { orderId } = await createOrder(this.#environment, this.#authenticated, {
         category: 'spot',
         symbol,
         side: 'Sell',
         orderType: 'Market',
         qty: quantity,
         marketUnit: 'baseCoin',
         isLeverage: 0,
         orderLinkId: clientOrderId,
         orderFilter: 'StopOrder',
         triggerPrice
      })
      return orderId
   }

   async cancelStopOrder(symbol: string, clientOrderId: string): Promise<void> {
      try {
         await cancelOrder(this.#environment, this.#authenticated, {
            category: 'spot',
            symbol,
            orderFilter: 'StopOrder',
            orderLinkId: clientOrderId
         })
      }
      catch (error) {
         if (!alreadyGone(error)) throw error
      }
   }

   async fetchOpenStops(): Promise<OpenStopOrder[]> {
      const orders = await fetchOpenStopOrders(this.#environment, this.#authenticated)
      return orders.map(({ orderId, orderLinkId, symbol, qty, triggerPrice }) => ({
         clientOrderId: orderLinkId,
         orderId,
         symbol,
         quantity: qty || '0',
         triggerPrice: triggerPrice || '0'
      }))
   }

   async fetchSettlement(clientOrderId: string): Promise<OrderSettlement | null> {

      const order = await fetchOrderByLinkId(this.#environment, this.#authenticated, clientOrderId)
      if (!order) return null

      const status = settlementStatus(order)
      const executed = Big(order.cumExecQty || 0).gt(0)

      return {
         orderId: order.orderId,
         status,
         base: order.cumExecQty || '0',
         quote: order.cumExecValue || '0',
         averagePrice: order.avgPrice || '0',
         fees: status === 'open' || !executed ? {} : await this.#feesOf(order),
         reason: order.rejectReason && order.rejectReason !== 'EC_NoError' ? order.rejectReason : ''
      }
   }

   async #feesOf(order: BybitOrder): Promise<Record<string, string>> {

      const detailed = nonZero(order.cumFeeDetail ?? {})
      if (Object.keys(detailed).length > 0) return detailed

      const executions = await fetchExecutions(this.#environment, this.#authenticated, order.orderId)
      const fees = executions.reduce<Record<string, Big>>((sum, { execFee, feeCurrency }) => {
         if (feeCurrency) sum[feeCurrency] = (sum[feeCurrency] ?? Big(0)).plus(execFee || 0)
         return sum
      }, {})

      return nonZero(Object.fromEntries(Object.entries(fees).map(([asset, amount]) => [asset, amount.toFixed()])))
   }
}
