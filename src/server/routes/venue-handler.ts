import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { venues } from '../services/portfolio/venues'
import { withCredentials } from './with-account'
import type { RequestBody } from './with-account'
import type { PortfolioExchange } from '../services/portfolio/exchange'
import type { Venue } from '../services/portfolio/venues'
import type { VenueId } from '../../types/portfolio'

export interface Refusal {
   status: ContentfulStatusCode
   message: string
}

type Action<S> = (service: S, body: RequestBody) => Promise<unknown>

export default function venueHandler<S>(
   venueId: VenueId,
   create: (venue: Venue, exchange: PortfolioExchange) => S,
   refusalOf: (error: unknown) => Refusal | null
) {
   const venue = venues[venueId]

   return (action: Action<S>) => (c: Context) =>
      withCredentials(c, venue.provider, async ({ body, credentials }) => {
         try {
            return c.json(await action(create(venue, venue.exchange(credentials)), body))
         }
         catch (error) {
            const refusal = refusalOf(error)
            if (refusal) return c.json({ error: refusal.message }, refusal.status)
            throw error
         }
      })
}
