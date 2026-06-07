import { Hono } from 'hono'
import { cors } from 'hono/cors'
import binanceRoutes from './routes/binance.js'
import krakenRoutes from './routes/kraken.js'

export function createApp() {
   const app = new Hono()

   app.use('/api/*', cors({
      origin: (origin) => {
         const allowed = ['http://localhost:3000', 'views://']
         if (allowed.some(o => o.endsWith('://') ? origin.startsWith(o) : origin === o)) {
            return origin
         }
         return null
      }
   }))

   app.use('*', async (c, next) => {
      const start = Date.now()
      await next()
      const ms = Date.now() - start
      const status = c.res.status
      const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m'
      const reset = '\x1b[0m'
      console.log(`${color}${c.req.method} ${new URL(c.req.url).pathname} → ${status}${reset} (${ms}ms)`)
   })

   app.route('/api/binance', binanceRoutes)
   app.route('/api/kraken', krakenRoutes)

   return app
}
