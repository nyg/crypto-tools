import { Hono } from 'hono'
import fundingRoutes from './funding'
import instantOrderRoutes from './instant-orders'
import portfolioRoutes from './portfolios'

const app = new Hono()

app.route('/portfolios', portfolioRoutes('bybit'))
app.route('/instant-orders', instantOrderRoutes('bybit'))
app.route('/funding', fundingRoutes('bybit'))
app.route('/demo/portfolios', portfolioRoutes('bybitDemo'))
app.route('/demo/instant-orders', instantOrderRoutes('bybitDemo'))

export default app
