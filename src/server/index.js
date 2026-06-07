import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { existsSync, statSync } from 'fs'
import path from 'path'
import binanceRoutes from './routes/binance.js'
import krakenRoutes from './routes/kraken.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const IS_PROD = process.env.NODE_ENV === 'production'

const app = new Hono()

// CORS for Vite dev server and Electrobun WebView
app.use('/api/*', cors({
   origin: (origin) => {
      const allowed = ['http://localhost:3000', 'views://']
      if (allowed.some(o => o.endsWith('://') ? origin.startsWith(o) : origin === o)) {
         return origin
      }
      return null
   }
}))

// Request logging
app.use('*', async (c, next) => {
   const start = Date.now()
   await next()
   const ms = Date.now() - start
   const status = c.res.status
   const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m'
   const reset = '\x1b[0m'
   console.log(`${color}${c.req.method} ${new URL(c.req.url).pathname} → ${status}${reset} (${ms}ms)`)
})

// API routes
app.route('/api/binance', binanceRoutes)
app.route('/api/kraken', krakenRoutes)

// Static file serving with SPA fallback (production only)
if (IS_PROD) {
   const DIST = path.resolve('./dist')

   app.get('*', (c) => {
      const url = new URL(c.req.url)
      const filePath = path.join(DIST, url.pathname)

      if (existsSync(filePath) && statSync(filePath).isFile()) {
         return new Response(Bun.file(filePath))
      }

      return new Response(Bun.file(path.join(DIST, 'index.html')))
   })
}

Bun.serve({
   port: PORT,
   fetch: app.fetch,
})

console.log(`✓ Server listening on http://localhost:${PORT}`)
