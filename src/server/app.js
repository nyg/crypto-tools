import { Hono } from 'hono'
import { cors } from 'hono/cors'
import appRoutes from './routes/app.js'
import binanceRoutes from './routes/binance.js'
import krakenRoutes from './routes/kraken.js'
import settingsRoutes from './routes/settings.js'

const allowedOrigins = ['http://localhost:3000', 'views://']

// Vite's port is configurable and the browser sends Origin on same-origin writes too,
// so pinning development to 3000 would 403 every write for anyone running it elsewhere.
// The packaged app only ever loads from views://, so this stays out of production.
const localhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/

const isAllowedOrigin = origin =>
   allowedOrigins.some(allowed =>
      allowed.endsWith('://') ? origin.startsWith(allowed) : origin === allowed)
   || (process.env.NODE_ENV !== 'production' && localhostOrigin.test(origin))

const readOnlyMethods = ['GET', 'HEAD', 'OPTIONS']

export function createApp() {
   const app = new Hono()

   app.use('/api/*', cors({
      origin: (origin) => isAllowedOrigin(origin) ? origin : null
   }))

   // CORS decides what a page may *read*; it does not stop the request being made.
   // A cross-origin POST with a simple content type is sent without a preflight, and
   // now that the server supplies the credentials, the body no longer proves who is
   // asking — so a foreign page could start a sync, clear the database or place
   // orders without ever seeing a response. The allowlist is therefore enforced here
   // as well, and writes must be application/json, which cannot be sent
   // cross-origin without a preflight the allowlist above already refuses.
   // A request with no Origin at all is the curl or native case, not a browser.
   app.use('/api/*', async (c, next) => {

      const origin = c.req.header('origin')
      if (origin && !isAllowedOrigin(origin)) {
         return c.json({ error: 'Origin not allowed.' }, 403)
      }

      if (!readOnlyMethods.includes(c.req.method)
         && !(c.req.header('content-type') ?? '').startsWith('application/json')) {
         return c.json({ error: 'Expected a JSON request body.' }, 415)
      }

      await next()
   })

   app.use('*', async (c, next) => {
      const start = Date.now()
      await next()
      const ms = Date.now() - start
      const status = c.res.status
      const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m'
      const reset = '\x1b[0m'
      console.log(`${color}${c.req.method} ${new URL(c.req.url).pathname} → ${status}${reset} (${ms}ms)`)
   })

   app.route('/api/app', appRoutes)
   app.route('/api/binance', binanceRoutes)
   app.route('/api/kraken', krakenRoutes)
   app.route('/api/settings', settingsRoutes)

   return app
}
