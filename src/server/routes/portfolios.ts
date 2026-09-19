import { Hono } from 'hono'
import type { Context } from 'hono'
import PortfolioService, { PortfolioError } from '../services/portfolio/portfolio-service'
import { venues } from '../services/portfolio/venues'
import { TargetError } from '../services/portfolio/targets'
import { withCredentials } from './with-account'
import type { RequestBody } from './with-account'
import type { VenueId } from '../../types/portfolio'

type Action = (service: PortfolioService, body: RequestBody) => Promise<unknown>

export default function portfolioRoutes(venueId: VenueId): Hono {

   const venue = venues[venueId]
   const app = new Hono()

   const handle = (action: Action) => (c: Context) =>
      withCredentials(c, venue.provider, async ({ body, credentials }) => {
         try {
            return c.json(await action(new PortfolioService(venue, venue.exchange(credentials)), body))
         }
         catch (error) {
            if (error instanceof PortfolioError) return c.json({ error: error.message }, error.status)
            if (error instanceof TargetError) return c.json({ error: error.message }, 400)
            throw error
         }
      })

   app.post('/overview', handle(service => service.overview()))
   app.get('/markets', handle(service => service.markets()))
   app.post('/save', handle((service, body) => service.save(body)))
   app.post('/archive', handle((service, body) => service.archive(body)))
   app.post('/deposit', handle((service, body) => service.deposit(body)))
   app.post('/adjust', handle((service, body) => service.adjust(body)))
   app.post('/plan', handle((service, body) => service.plan(body)))
   app.post('/execute', handle((service, body) => service.execute(body)))
   app.post('/run', handle((service, body) => service.run(body)))
   app.post('/history', handle((service, body) => service.history(body)))

   return app
}
