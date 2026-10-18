import SettingsLink from '../lib/settings-link'
import type { ExchangeVenue } from '../lib/venue-tabs'

export const bybitVenue: ExchangeVenue = {
   id: 'bybit',
   tab: 'Mainnet',
   label: 'Bybit',
   apiRoot: '/api/bybit',
   live: true,
   setup: <>Create a Bybit API key with the Read and Spot trade permissions, and add it in <SettingsLink group="Bybit" /> under Bybit.</>
}

export const bybitDemoVenue: ExchangeVenue = {
   id: 'bybitDemo',
   tab: 'Demo',
   label: 'Bybit demo',
   apiRoot: '/api/bybit/demo',
   live: false,
   setup: <>Switch Bybit to demo trading, create an API key there, and add it in <SettingsLink group="Bybit" /> under Bybit demo trading.</>
}
