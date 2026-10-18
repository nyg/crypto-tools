import SettingsLink from '../lib/settings-link'
import type { ExchangeVenue } from '../lib/venue-tabs'

export const krakenVenue: ExchangeVenue = {
   id: 'kraken',
   tab: 'Mainnet',
   label: 'Kraken',
   apiRoot: '/api/kraken',
   live: true,
   setup: <>Create a Kraken API key with the Query Funds, Query Open Orders & Trades, Query Closed Orders & Trades, Create & Modify Orders and Cancel/Close Orders permissions, and add it in <SettingsLink group="Kraken" /> under Kraken.</>
}
