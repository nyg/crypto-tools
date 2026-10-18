import SettingsLink from '../lib/settings-link'
import type { ExchangeVenue } from '../lib/venue-tabs'

export const binanceVenue: ExchangeVenue = {
   id: 'binance',
   tab: 'Mainnet',
   label: 'Binance',
   apiRoot: '/api/binance',
   live: true,
   setup: <>Create a Binance API key with Enable Reading and Enable Spot & Margin Trading, and add it in <SettingsLink group="Binance" /> under Binance.</>
}

export const binanceTestnetVenue: ExchangeVenue = {
   id: 'binanceTestnet',
   tab: 'Testnet',
   label: 'Binance testnet',
   apiRoot: '/api/binance/testnet',
   live: false,
   setup: <>Log in to testnet.binance.vision, generate an HMAC API key there, and add it in <SettingsLink group="Binance" /> under Binance testnet.</>
}
