import { Hono } from 'hono'

const app = new Hono()

const LATEST_RELEASE_URL = 'https://api.github.com/repos/nyg/crypto-tools/releases/latest'
const RELEASES_URL = 'https://github.com/nyg/crypto-tools/releases/latest'
const REQUEST_TIMEOUT_MS = 5000
const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000
const FAILURE_TTL_MS = 15 * 60 * 1000

let cached = null

async function fetchLatestRelease() {

   const response = await fetch(LATEST_RELEASE_URL, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'crypto-tools' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
   })

   if (!response.ok) {
      throw new Error(`GitHub answered ${response.status}`)
   }

   const release = await response.json()
   const version = String(release?.tag_name ?? '').replace(/^v/, '')

   if (!version) {
      throw new Error('the latest release has no tag name')
   }

   return { version, url: release.html_url || RELEASES_URL }
}

app.get('/latest-release', async (c) => {

   if (cached && Date.now() < cached.expiresAt) {
      return cached.release
         ? c.json(cached.release)
         : c.json({ error: cached.error }, 502)
   }

   try {
      const release = await fetchLatestRelease()
      cached = { release, expiresAt: Date.now() + SUCCESS_TTL_MS }
      return c.json(release)
   }
   catch (error) {
      console.warn('Could not read the latest release:', error.message)
      cached = { error: 'Could not check for updates.', expiresAt: Date.now() + FAILURE_TTL_MS }
      return c.json({ error: cached.error }, 502)
   }
})

export default app
