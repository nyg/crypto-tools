import { Hono } from 'hono'
import portfolioRoutes from './portfolios'

const app = new Hono()

app.route('/portfolios', portfolioRoutes('bybit'))
app.route('/demo/portfolios', portfolioRoutes('bybitDemo'))

export default app
