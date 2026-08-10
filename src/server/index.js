import { existsSync, statSync } from 'fs'
import path from 'path'
import { createApp } from './app.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const IS_PROD = process.env.NODE_ENV === 'production'

const app = createApp()

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
