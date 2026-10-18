import { Hono } from 'hono'
import InstantOrderService, { InstantOrderError } from '../services/instant-order/instant-order-service'
import venueHandler from './venue-handler'
import type { VenueId } from '../../types/portfolio'

const refusalOf = (error: unknown) =>
   error instanceof InstantOrderError ? { status: error.status, message: error.message } : null

export default function instantOrderRoutes(venueId: VenueId): Hono {

   const app = new Hono()
   const handle = venueHandler(venueId, (venue, exchange) => new InstantOrderService(venue, exchange), refusalOf)

   app.get('/markets', handle(service => service.markets()))
   app.post('/book', handle((service, body) => service.book(body)))
   app.post('/account', handle((service, body) => service.account(body)))
   app.post('/place', handle((service, body) => service.place(body)))
   app.post('/status', handle((service, body) => service.status(body)))
   app.post('/cancel', handle((service, body) => service.cancel(body)))

   return app
}
