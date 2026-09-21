import BinanceExchange from './binance-exchange'
import BybitExchange from './bybit-exchange'
import KrakenExchange from './kraken-exchange'
import type { PortfolioExchange } from './exchange'
import type { Credentials, Provider } from '../../../types/credentials'
import type { VenueId } from '../../../types/portfolio'

export interface Venue {
   id: VenueId
   provider: Provider
   label: string
   quoteAssets: string[]
   valuationAsset: string
   hardStops: boolean
   stopsReserve: boolean
   exchange: (credentials: Credentials) => PortfolioExchange
}

const STABLECOINS = ['USDT', 'USDC']

export const venues: Record<VenueId, Venue> = {
   bybit: {
      id: 'bybit',
      provider: 'bybit',
      label: 'Bybit',
      quoteAssets: STABLECOINS,
      valuationAsset: 'USDT',
      hardStops: true,
      stopsReserve: false,
      exchange: credentials => new BybitExchange('mainnet', credentials)
   },
   bybitDemo: {
      id: 'bybitDemo',
      provider: 'bybitDemo',
      label: 'Bybit demo trading',
      quoteAssets: STABLECOINS,
      valuationAsset: 'USDT',
      hardStops: true,
      stopsReserve: false,
      exchange: credentials => new BybitExchange('demo', credentials)
   },
   kraken: {
      id: 'kraken',
      provider: 'kraken',
      label: 'Kraken',
      quoteAssets: ['USD', 'EUR', ...STABLECOINS],
      valuationAsset: 'USD',
      hardStops: true,
      stopsReserve: true,
      exchange: credentials => new KrakenExchange(credentials)
   },
   binance: {
      id: 'binance',
      provider: 'binance',
      label: 'Binance',
      quoteAssets: STABLECOINS,
      valuationAsset: 'USDT',
      hardStops: true,
      stopsReserve: true,
      exchange: credentials => new BinanceExchange('mainnet', credentials)
   },
   binanceTestnet: {
      id: 'binanceTestnet',
      provider: 'binanceTestnet',
      label: 'Binance testnet',
      quoteAssets: STABLECOINS,
      valuationAsset: 'USDT',
      hardStops: true,
      stopsReserve: true,
      exchange: credentials => new BinanceExchange('testnet', credentials)
   }
}
