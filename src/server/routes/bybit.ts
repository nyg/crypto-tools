import { Hono } from 'hono'
import fundingRoutes from './funding'
import portfolioRoutes from './portfolios'

const app = new Hono()

app.route('/portfolios', portfolioRoutes('bybit'))
app.route('/funding', fundingRoutes('bybit'))
app.route('/demo/portfolios', portfolioRoutes('bybitDemo'))

export default app
