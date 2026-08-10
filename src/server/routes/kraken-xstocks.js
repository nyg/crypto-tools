import { Hono } from 'hono'
import KrakenAPI from '../adapters/kraken-api/adapter.js'
import AnthropicAPI, { MODEL } from '../adapters/anthropic/adapter.js'
import XStockRepository from '../db/xstock-repository.js'
import { handleError, withCredentials } from './with-account.js'
import seed from '../data/xstocks.json'

const app = new Hono()

const MAX_BATCH = 20
const MIN_WORD_COUNT = 10
const MAX_WORD_COUNT = 300
const VOLUME_TTL_MS = 60 * 1000

let volumeCache = { at: 0, volumes: new Map() }

async function tokenizedVolumes(krakenAPI) {
   if (Date.now() - volumeCache.at < VOLUME_TTL_MS) return volumeCache.volumes

   try {
      const volumes = await krakenAPI.fetchTokenizedVolumes()
      if (volumes.size > 0) volumeCache = { at: Date.now(), volumes }
      return volumes
   }
   catch (error) {
      console.log('Could not read tokenized 24h volumes:', error.message)
      return volumeCache.volumes
   }
}

const asWordCount = (value) =>
   Math.min(MAX_WORD_COUNT, Math.max(MIN_WORD_COUNT, Math.round(Number(value)) || 60))

const seededListing = (ticker) => {
   const entry = seed.listings[ticker]
   return entry ? { ...entry, origin: 'seed', confidence: 'high', sources: [] } : null
}

const resolveTickers = (requested, byTicker) =>
   [...new Set(requested)].filter(ticker => byTicker.has(ticker)).slice(0, MAX_BATCH)

function reconcile(requested, returned, byTicker) {

   const wanted = new Set(requested)
   const seen = new Map()

   for (const item of returned) {
      if (!wanted.has(item.ticker)) {
         console.warn(`xStocks classification returned an unrequested ticker, dropping: ${item.ticker}`)
         continue
      }
      seen.set(item.ticker, item)
   }

   return requested.map(ticker => {
      const item = seen.get(ticker)
      if (!item) console.warn(`xStocks classification omitted a requested ticker: ${ticker}`)

      const named = Boolean(item?.officialName?.trim())
      const type = !item || !named ? 'unknown' : item.type

      return {
         ticker,
         altname: byTicker.get(ticker).altname,
         name: named ? item.officialName.trim() : '',
         exchange: item?.listingExchange ?? '',
         type,
         subtype: type === 'unknown' ? '' : item.subtype ?? '',
         confidence: type === 'unknown' ? 'low' : item.confidence ?? 'low',
         sources: item?.sources ?? [],
         origin: 'ai'
      }
   })
}

app.post('/listings', async (c) => {

   const body = await c.req.json().catch(() => ({}))
   const wordCount = asWordCount(body.wordCount)

   try {
      const krakenAPI = new KrakenAPI()
      const listings = await krakenAPI.fetchTokenizedListings()
      const tickers = listings.map(listing => listing.ticker)

      const repository = new XStockRepository()
      const stored = repository.findListings(tickers)
      const descriptions = repository.findDescriptions(tickers, wordCount)
      const volumes = await tokenizedVolumes(krakenAPI)

      const rows = listings.map(({ altname, ticker }) => {
         const base = seededListing(ticker) ?? stored.get(ticker)
         const market = volumes.get(altname)
         return {
            altname,
            ticker,
            name: base?.name ?? '',
            exchange: base?.exchange ?? '',
            type: base?.type ?? 'unclassified',
            subtype: base?.subtype ?? '',
            confidence: base?.confidence ?? '',
            origin: base?.origin ?? '',
            sources: base?.sources ?? [],
            last: market?.last ?? null,
            volume24h: market?.volume24h ?? null,
            volumeUsd24h: market?.volumeUsd24h ?? null,
            description: descriptions.get(ticker)?.description ?? ''
         }
      })

      return c.json({ wordCount, listings: rows })
   }
   catch (error) {
      return handleError(c, error)
   }
})

app.post('/classify', async (c) => withCredentials(c, 'anthropic', async ({ body, credentials }) => {

   const { tickers = [] } = body

   const krakenAPI = new KrakenAPI()
   const listings = await krakenAPI.fetchTokenizedListings()
   const byTicker = new Map(listings.map(listing => [listing.ticker, listing]))

   const requested = resolveTickers(tickers, byTicker).filter(ticker => !seed.listings[ticker])
   if (requested.length === 0) return c.json({ classified: [] })

   const anthropicAPI = new AnthropicAPI(credentials.apiKey)
   const returned = await anthropicAPI.classifyListings(requested)
   const classified = reconcile(requested, returned, byTicker)

   new XStockRepository().upsertListings(classified, Date.now())
   return c.json({ classified })
}, { secret: false }))

app.post('/describe', async (c) => withCredentials(c, 'anthropic', async ({ body, credentials }) => {

   const { tickers = [] } = body
   const wordCount = asWordCount(body.wordCount)

   const krakenAPI = new KrakenAPI()
   const listings = await krakenAPI.fetchTokenizedListings()
   const byTicker = new Map(listings.map(listing => [listing.ticker, listing]))

   const requested = resolveTickers(tickers, byTicker)
   if (requested.length === 0) return c.json({ described: [], wordCount })

   const repository = new XStockRepository()
   const stored = repository.findListings(requested)

   const targets = requested.map(ticker => {
      const base = seededListing(ticker) ?? stored.get(ticker)
      return {
         ticker,
         name: base?.name ?? '',
         exchange: base?.exchange ?? '',
         type: base?.type ?? 'unknown',
         subtype: base?.subtype ?? ''
      }
   })

   const anthropicAPI = new AnthropicAPI(credentials.apiKey)
   const described = (await anthropicAPI.describeListings(targets, wordCount))
      .filter(item => item.description.trim())

   repository.upsertDescriptions(described, wordCount, MODEL, Date.now())
   return c.json({ described, wordCount })
}, { secret: false }))

export default app
