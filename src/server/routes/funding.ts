import { Hono } from 'hono'

import type { FundingVenueId } from '../../types/funding'
import { cancelFundingSync, fundingOverview, startFundingSync } from '../services/funding/funding-sync'
import { fundingVenues } from '../services/funding/venues'
import { withCredentials } from './with-account'

export default function fundingRoutes(venueId: FundingVenueId): Hono {

   const venue = fundingVenues[venueId]
   const app = new Hono()

   app.get('/', c => withCredentials(c, venue.provider, ({ credentials }) =>
      c.json(fundingOverview(venue, credentials))))

   app.post('/sync', c => withCredentials(c, venue.provider, ({ credentials }) =>
      c.json(startFundingSync(venue, credentials))))

   app.post('/sync/cancel', c => withCredentials(c, venue.provider, ({ credentials }) =>
      c.json(cancelFundingSync(venue, credentials))))

   return app
}
