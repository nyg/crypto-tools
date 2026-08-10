import { existsSync, statSync } from 'fs'
import path from 'path'
import { createApp } from './app.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const IS_PROD = process.env.NODE_ENV === 'production'

const app = createApp()

// Static file serving with SPA fallback (production only)
if (IS_PROD) {
   const DIST = path.resolve('./dist')

   const distFile = (pathname) => {
      const segments = pathname.split('/').filter(Boolean)

      for (let start = 0; start < segments.length; start++) {
         const candidate = path.join(DIST, ...segments.slice(start))
         if (!candidate.startsWith(DIST + path.sep)) continue
         if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
      }

      return null
   }

   app.get('*', (c) => {
      const file = distFile(new URL(c.req.url).pathname)
      return new Response(Bun.file(file ?? path.join(DIST, 'index.html')))
   })
}

Bun.serve({
   port: PORT,
   fetch: app.fetch,
})

console.log(`✓ Server listening on http://localhost:${PORT}`)
