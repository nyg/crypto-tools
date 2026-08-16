import { existsSync, statSync } from 'fs'
import path from 'path'
import { createApp } from './app.js'
import { initSecretStore } from './secret-store/index.js'
import { migrateSettings } from './settings.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const IS_PROD = process.env.NODE_ENV === 'production'

await initSecretStore()
migrateSettings()

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

   const isAssetRequest = (pathname) => pathname.split('/').includes('assets')

   app.get('*', (c) => {
      const pathname = new URL(c.req.url).pathname
      const file = distFile(pathname)

      if (file) return new Response(Bun.file(file))
      if (isAssetRequest(pathname)) return c.notFound()

      return new Response(Bun.file(path.join(DIST, 'index.html')))
   })
}

Bun.serve({
   port: PORT,
   fetch: app.fetch,
})

console.log(`✓ Server listening on http://localhost:${PORT}`)
