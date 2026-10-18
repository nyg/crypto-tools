import { Hono } from 'hono'
import PortfolioService, { PortfolioError } from '../services/portfolio/portfolio-service'
import { TargetError } from '../services/portfolio/targets'
import venueHandler from './venue-handler'
import type { VenueId } from '../../types/portfolio'

const refusalOf = (error: unknown) => {
   if (error instanceof PortfolioError) return { status: error.status, message: error.message }
   if (error instanceof TargetError) return { status: 400 as const, message: error.message }
   return null
}

export default function portfolioRoutes(venueId: VenueId): Hono {

   const app = new Hono()
   const handle = venueHandler(venueId, (venue, exchange) => new PortfolioService(venue, exchange), refusalOf)

   app.post('/overview', handle(service => service.overview()))
   app.get('/markets', handle(service => service.markets()))
   app.get('/supertrend', handle(service => service.supertrend()))
   app.post('/save', handle((service, body) => service.save(body)))
   app.post('/archive', handle((service, body) => service.archive(body)))
   app.post('/deposit', handle((service, body) => service.deposit(body)))
   app.post('/adjust', handle((service, body) => service.adjust(body)))
   app.post('/withdraw', handle((service, body) => service.withdraw(body)))
   app.post('/plan', handle((service, body) => service.plan(body)))
   app.post('/execute', handle((service, body) => service.execute(body)))
   app.post('/run', handle((service, body) => service.run(body)))
   app.post('/stop', handle((service, body) => service.stop(body)))
   app.post('/stops/sync', handle((service, body) => service.syncStops(body)))
   app.post('/stops/ack', handle((service, body) => service.ackStop(body)))
   app.post('/history', handle((service, body) => service.history(body)))

   return app
}
