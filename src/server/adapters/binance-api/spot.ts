import Big from 'big.js'
import { HttpRequesterError } from '../../errors'
import type {
   BinanceAccount, BinanceBookTicker, BinanceCommission, BinanceErrorBody, BinanceExchangeInfo, BinanceOrder,
   BinanceSymbol, BinanceTickerPrice, BinanceTrade
} from '../../../types/binance-api'
import type {
   ExchangeAccount, OpenStopOrder, OrderSettlement, SettlementStatus, SpotMarket, SpotPrice, TakerFee, WalletCoin
} from '../../../types/portfolio'

const OPEN_STATUSES = ['NEW', 'PENDING_NEW', 'PARTIALLY_FILLED', 'PENDING_CANCEL']

const decimal = (value: string | undefined): string => Big(value || 0).toFixed()

const positive = (value: string | undefined): string | null => Big(value || 0).gt(0) ? decimal(value) : null

export function binanceError(error: unknown): BinanceErrorBody | null {
   if (!(error instanceof HttpRequesterError) || typeof error.body !== 'string') return null
   try {
      const parsed = JSON.parse(error.body) as Partial<BinanceErrorBody> | null
      return typeof parsed?.code === 'number' ? { code: parsed.code, msg: String(parsed.msg ?? '') } : null
   }
   catch {
      return null
   }
}

export const hasBinanceCode = (error: unknown, code: number): boolean => binanceError(error)?.code === code

function spotMarket({ symbol, baseAsset, quoteAsset, quoteAssetPrecision, filters = [] }: BinanceSymbol): SpotMarket {

   const filter = (type: string) => filters.find(({ filterType }) => filterType === type)
   const lot = filter('LOT_SIZE')
   const marketLot = filter('MARKET_LOT_SIZE')
   const notional = filter('NOTIONAL') ?? filter('MIN_NOTIONAL')

   return {
      symbol,
      base: baseAsset,
      quote: quoteAsset,
      baseStep: decimal(lot?.stepSize),
      quoteStep: Big(1).div(Big(10).pow(quoteAssetPrecision)).toFixed(),
      tickStep: decimal(filter('PRICE_FILTER')?.tickSize),
      minQty: positive(marketLot?.minQty) ?? decimal(lot?.minQty),
      minAmount: decimal(notional?.minNotional),
      maxQty: positive(marketLot?.maxQty) ?? decimal(lot?.maxQty),
      maxAmount: decimal(notional?.maxNotional)
   }
}

export function takerFee({ standardCommission, specialCommission, taxCommission }: BinanceCommission): TakerFee {
   const tiers = [standardCommission, specialCommission, taxCommission]
   const rateFor = (side: 'buyer' | 'seller') =>
      tiers.reduce((sum, tier) => sum.plus(tier?.taker || 0).plus(tier?.[side] || 0), Big(0)).toFixed()
   return { buy: rateFor('buyer'), sell: rateFor('seller') }
}

export function spotMarkets({ symbols }: BinanceExchangeInfo): SpotMarket[] {
   return symbols
      .filter(({ status, isSpotTradingAllowed, orderTypes }) =>
         status === 'TRADING' && isSpotTradingAllowed !== false && (orderTypes?.includes('MARKET') ?? true))
      .map(spotMarket)
}

export function spotPrices(tickers: BinanceTickerPrice[], books: BinanceBookTicker[]): Record<string, SpotPrice> {

   const quotes = new Map(books.map(book => [book.symbol, book]))

   return Object.fromEntries(tickers.map(({ symbol, price }) => {
      const book = quotes.get(symbol)
      return [symbol, { last: price, bid: positive(book?.bidPrice) ?? price, ask: positive(book?.askPrice) ?? price }]
   }))
}

export function spotAccount({ uid, canTrade }: BinanceAccount, fallbackId: string): ExchangeAccount {
   return { accountId: uid ? String(uid) : fallbackId, canTrade, expiresAt: null }
}

export function spotWallet({ balances }: BinanceAccount): WalletCoin[] {
   return balances
      .map(({ asset, free, locked }) => ({
         asset,
         total: Big(free || 0).plus(locked || 0).toFixed(),
         free: decimal(free),
         borrowed: '0'
      }))
      .filter(({ total }) => !Big(total).eq(0))
}

function settlementStatus({ status, executedQty }: BinanceOrder): SettlementStatus {
   if (OPEN_STATUSES.includes(status)) return 'open'
   const executed = Big(executedQty || 0).gt(0)
   if (status === 'FILLED' && executed) return 'filled'
   return executed ? 'partial' : 'rejected'
}

export function settlementOf(order: BinanceOrder, trades: BinanceTrade[]): OrderSettlement {

   const status = settlementStatus(order)
   const base = Big(order.executedQty || 0)
   const quote = Big(order.cummulativeQuoteQty || 0)

   const fees = trades
      .filter(({ orderId }) => orderId === order.orderId)
      .reduce<Record<string, Big>>((sum, { commission, commissionAsset }) => {
         sum[commissionAsset] = (sum[commissionAsset] ?? Big(0)).plus(commission || 0)
         return sum
      }, {})

   return {
      orderId: String(order.orderId),
      status,
      base: base.toFixed(),
      quote: quote.toFixed(),
      averagePrice: base.gt(0) ? quote.div(base).round(12).toFixed() : '0',
      fees: Object.fromEntries(Object.entries(fees)
         .filter(([, amount]) => !amount.eq(0))
         .map(([asset, amount]) => [asset, amount.toFixed()])),
      reason: status === 'rejected' || status === 'partial' ? order.status : ''
   }
}

export function openStops(orders: BinanceOrder[]): OpenStopOrder[] {
   return orders
      .filter(({ type }) => type === 'STOP_LOSS')
      .map(({ clientOrderId, orderId, symbol, origQty, stopPrice }) => ({
         clientOrderId,
         orderId: String(orderId),
         symbol,
         quantity: decimal(origQty),
         triggerPrice: decimal(stopPrice)
      }))
}
