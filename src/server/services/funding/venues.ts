import BinanceAPI from '../../adapters/binance-api/adapter'
import BybitAPI from '../../adapters/bybit-api/adapter'
import { venues } from '../portfolio/venues'
import type { PortfolioExchange } from '../portfolio/exchange'
import type { Credentials, Provider } from '../../../types/credentials'
import type { FundingRecord, FundingVenueId, FundingWindow } from '../../../types/funding'

const DAY = 86400000

export interface FundingFeed {
   id: string
   label: string
   windowMs: number
   fetch: (window: FundingWindow) => Promise<FundingRecord[]>
}

export interface FundingVenue {
   id: FundingVenueId
   provider: Provider
   epoch: number
   exchange: (credentials: Credentials) => Pick<PortfolioExchange, 'account' | 'describeError'>
   feeds: (credentials: Credentials) => FundingFeed[]
}

function binanceFeeds(credentials: Credentials): FundingFeed[] {

   const api = new BinanceAPI(credentials)

   // One window for fiat: Binance only serves about the last 90 days of fiat orders,
   // whatever range is asked for, and each call costs a quarter of a minute's budget.
   return [
      { id: 'crypto-deposit', label: 'Crypto deposits', windowMs: 90 * DAY, fetch: window => api.fetchDeposits(window) },
      { id: 'crypto-withdrawal', label: 'Crypto withdrawals', windowMs: 90 * DAY, fetch: window => api.fetchWithdrawals(window) },
      { id: 'fiat-deposit', label: 'Fiat deposits', windowMs: Infinity, fetch: window => api.fetchFiatMovements('deposit', window) },
      { id: 'fiat-withdrawal', label: 'Fiat withdrawals', windowMs: Infinity, fetch: window => api.fetchFiatMovements('withdrawal', window) }
   ]
}

function bybitFeeds(credentials: Credentials): FundingFeed[] {

   const api = new BybitAPI('mainnet', credentials)

   return [
      { id: 'deposit', label: 'Deposits', windowMs: 30 * DAY, fetch: window => api.fetchDeposits(window) },
      { id: 'internal-deposit', label: 'Internal deposits', windowMs: 30 * DAY, fetch: window => api.fetchInternalDeposits(window) },
      { id: 'withdrawal', label: 'Withdrawals', windowMs: 30 * DAY, fetch: window => api.fetchWithdrawals(window) }
   ]
}

// The epoch is where a first sync starts walking from: no account is older than its exchange.
export const fundingVenues: Record<FundingVenueId, FundingVenue> = {
   binance: {
      id: 'binance',
      provider: 'binance',
      epoch: Date.UTC(2017, 6, 1),
      exchange: venues.binance.exchange,
      feeds: binanceFeeds
   },
   bybit: {
      id: 'bybit',
      provider: 'bybit',
      epoch: Date.UTC(2018, 2, 1),
      exchange: venues.bybit.exchange,
      feeds: bybitFeeds
   }
}
