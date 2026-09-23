import Big from 'big.js'
import { normalizeAsset } from './assets'
import { HttpRequesterError } from '../../errors'
import type { KrakenSpotMarket } from '../../../types/kraken'
import type {
   KrakenAssetPairs, KrakenExtendedBalance, KrakenOpenOrder, KrakenTicker, KrakenTradeVolume
} from '../../../types/kraken-api'
import type {
   OpenStopOrder, OrderSettlement, SettlementStatus, SpotPrice, TakerFee, WalletCoin
} from '../../../types/portfolio'

const stepOf = (decimals: number | undefined): string =>
   decimals === undefined ? '0' : Big(1).div(Big(10).pow(decimals)).toFixed()

export function krakenErrors(error: HttpRequesterError): string[] {
   return Array.isArray(error.body) ? error.body.map(String) : []
}

export const hasKrakenError = (error: unknown, prefix: string): boolean =>
   error instanceof HttpRequesterError && krakenErrors(error).some(message => message.startsWith(prefix))

export function spotMarkets(assetPairs: KrakenAssetPairs | undefined): KrakenSpotMarket[] {

   const markets = new Map<string, KrakenSpotMarket>()

   for (const [pair, entry] of Object.entries(assetPairs ?? {})) {
      if (!entry.altname || entry.altname.includes('.')) continue
      if (entry.status && entry.status !== 'online') continue

      const base = normalizeAsset(entry.base)
      const quote = normalizeAsset(entry.quote)
      const symbol = `${base}${quote}`
      if (markets.has(symbol)) continue

      markets.set(symbol, {
         symbol,
         base,
         quote,
         pair,
         altname: entry.altname,
         baseStep: stepOf(entry.lot_decimals),
         quoteStep: stepOf(entry.cost_decimals),
         tickStep: entry.tick_size ?? stepOf(entry.pair_decimals),
         minQty: entry.ordermin ?? '0',
         minAmount: entry.costmin ?? '0',
         maxQty: '0',
         maxAmount: '0'
      })
   }

   return [...markets.values()]
}

export function spotPrices(ticker: KrakenTicker, markets: KrakenSpotMarket[]): Record<string, SpotPrice> {

   const symbols = new Map(markets.flatMap(({ pair, altname, symbol }) => [[pair, symbol], [altname, symbol]]))
   const prices: Record<string, SpotPrice> = {}

   for (const [name, entry] of Object.entries(ticker)) {
      const symbol = symbols.get(name)
      const last = entry.c?.[0]
      if (!symbol || !last) continue
      prices[symbol] = { last, bid: entry.b?.[0] || last, ask: entry.a?.[0] || last }
   }

   return prices
}

export function spotWallet(balances: KrakenExtendedBalance): WalletCoin[] {

   const wallet = new Map<string, { total: Big, free: Big }>()

   for (const [key, { balance, hold_trade }] of Object.entries(balances)) {
      if (key.includes('.')) continue

      const total = Big(balance || 0)
      if (total.eq(0)) continue

      const asset = normalizeAsset(key)
      const known = wallet.get(asset) ?? { total: Big(0), free: Big(0) }
      wallet.set(asset, { total: known.total.plus(total), free: known.free.plus(total.minus(hold_trade || 0)) })
   }

   return [...wallet].map(([asset, { total, free }]) =>
      ({ asset, total: total.toFixed(), free: free.toFixed(), borrowed: '0' }))
}

export function takerFees({ fees }: KrakenTradeVolume, markets: KrakenSpotMarket[]): Record<string, TakerFee> {
   const symbolOf = new Map(markets.flatMap(({ symbol, pair, altname }) => [[pair, symbol], [altname, symbol]]))
   return Object.fromEntries(Object.entries(fees ?? {}).flatMap(([pair, { fee }]) => {
      const symbol = symbolOf.get(pair)
      if (!symbol || !fee) return []
      const rate = Big(fee).div(100).toFixed()
      return [[symbol, { buy: rate, sell: rate }]]
   }))
}

function settlementStatus({ status, vol_exec }: KrakenOpenOrder): SettlementStatus {
   if (status === 'pending' || status === 'open') return 'open'
   const executed = Big(vol_exec || 0).gt(0)
   if (status === 'closed' && executed) return 'filled'
   return executed ? 'partial' : 'rejected'
}

export function settlementOf(txid: string, order: KrakenOpenOrder, quoteAsset: string): OrderSettlement {

   const status = settlementStatus(order)
   const fee = Big(order.fee || 0)

   return {
      orderId: txid,
      status,
      base: order.vol_exec || '0',
      quote: order.cost || '0',
      averagePrice: order.price || '0',
      fees: status === 'open' || fee.eq(0) ? {} : { [quoteAsset]: fee.toFixed() },
      reason: status === 'rejected' || status === 'partial' ? order.reason ?? order.status ?? '' : ''
   }
}

export function openStops(orders: Record<string, KrakenOpenOrder>, markets: KrakenSpotMarket[]): OpenStopOrder[] {

   const symbols = new Map(markets.map(({ altname, symbol }) => [altname, symbol]))

   return Object.entries(orders)
      .filter(([, order]) => order.descr?.ordertype === 'stop-loss' && order.cl_ord_id)
      .map(([txid, order]) => ({
         clientOrderId: order.cl_ord_id!,
         orderId: txid,
         symbol: symbols.get(order.descr?.pair ?? '') ?? order.descr?.pair ?? '',
         quantity: order.vol || '0',
         triggerPrice: order.descr?.price || '0'
      }))
}
