import BybitExchange from './bybit-exchange'
import type { PortfolioExchange } from './exchange'
import type { Credentials, Provider } from '../../../types/credentials'
import type { VenueId } from '../../../types/portfolio'

export interface Venue {
   id: VenueId
   provider: Provider
   label: string
   exchange: (credentials: Credentials) => PortfolioExchange
}

export const venues: Record<VenueId, Venue> = {
   bybit: {
      id: 'bybit',
      provider: 'bybit',
      label: 'Bybit',
      exchange: credentials => new BybitExchange('mainnet', credentials)
   },
   bybitDemo: {
      id: 'bybitDemo',
      provider: 'bybitDemo',
      label: 'Bybit demo trading',
      exchange: credentials => new BybitExchange('demo', credentials)
   }
}
