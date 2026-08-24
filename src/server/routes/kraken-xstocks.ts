import { Hono } from 'hono'
import KrakenAPI from '../adapters/kraken-api/adapter'
import XStockRepository from '../db/xstock-repository'
import { handleError, withCredentials } from './with-account'
import { isSeeded, seededListing } from '../services/xstock-reference'
import { currentJob, requestCancel, startClassify, startDescribe } from '../services/xstock-ai-job'
import { messageOf } from '../errors'
import type { TokenizedListing, TokenizedVolume } from '../../types/kraken'
import type { XStockRow } from '../../types/api'

const app = new Hono()

const MIN_WORD_COUNT = 10
const MAX_WORD_COUNT = 300
const VOLUME_TTL_MS = 60 * 1000

let volumeCache: { at: number, volumes: Map<string, TokenizedVolume> } = { at: 0, volumes: new Map() }

async function tokenizedVolumes(krakenAPI: KrakenAPI) {
   if (Date.now() - volumeCache.at < VOLUME_TTL_MS) return volumeCache.volumes

   try {
      const volumes = await krakenAPI.fetchTokenizedVolumes()
      if (volumes.size > 0) volumeCache = { at: Date.now(), volumes }
      return volumes
   }
   catch (error) {
      console.log('Could not read tokenized 24h volumes:', messageOf(error))
      return volumeCache.volumes
   }
}

const asWordCount = (value: unknown) =>
   Math.min(MAX_WORD_COUNT, Math.max(MIN_WORD_COUNT, Math.round(Number(value)) || 60))

async function requestedListings(tickers: string[]): Promise<TokenizedListing[]> {

   const listings = await new KrakenAPI().fetchTokenizedListings()
   const byTicker = new Map(listings.map(listing => [listing.ticker, listing]))

   return [...new Set(tickers)]
      .map(ticker => byTicker.get(ticker))
      .filter((listing): listing is TokenizedListing => listing !== undefined)
}

app.post('/listings', async (c) => {

   const body: { wordCount?: unknown } = await c.req.json().catch(() => ({}))
   const wordCount = asWordCount(body.wordCount)

   try {
      const krakenAPI = new KrakenAPI()
      const listings = await krakenAPI.fetchTokenizedListings()
      const tickers = listings.map(listing => listing.ticker)

      const repository = new XStockRepository()
      const stored = repository.findListings(tickers)
      const descriptions = repository.findDescriptions(tickers, wordCount)
      const volumes = await tokenizedVolumes(krakenAPI)

      const rows = listings.map(({ altname, ticker }): XStockRow => {
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

app.get('/job', async (c) => c.json({ job: currentJob() }))

app.post('/job/cancel', async (c) => c.json({ job: requestCancel() }))

app.post('/classify', async (c) => withCredentials(c, 'anthropic', async ({ body, credentials }) => {

   const listings = (await requestedListings(body.tickers as string[] ?? []))
      .filter(listing => !isSeeded(listing.ticker))

   if (listings.length === 0) return c.json({ job: currentJob(), alreadyRunning: false })

   return c.json(startClassify({ credentials, listings }))
}, { secret: false }))

app.post('/describe', async (c) => withCredentials(c, 'anthropic', async ({ body, credentials }) => {

   const wordCount = asWordCount(body.wordCount)
   const listings = await requestedListings(body.tickers as string[] ?? [])

   if (listings.length === 0) return c.json({ job: currentJob(), alreadyRunning: false })

   return c.json(startDescribe({
      credentials,
      wordCount,
      tickers: listings.map(listing => listing.ticker)
   }))
}, { secret: false }))

export default app
