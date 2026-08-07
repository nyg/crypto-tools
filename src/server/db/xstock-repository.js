import { getDatabase } from './database.js'

const upsertListingStatement = `
   INSERT INTO xstock_listing (
      ticker, altname, name, exchange, type, subtype, confidence, sources, origin, classified_at)
   VALUES ($ticker, $altname, $name, $exchange, $type, $subtype, $confidence, $sources, $origin, $classifiedAt)
   ON CONFLICT (ticker) DO UPDATE SET
      altname = excluded.altname, name = excluded.name, exchange = excluded.exchange,
      type = excluded.type, subtype = excluded.subtype, confidence = excluded.confidence,
      sources = excluded.sources, origin = excluded.origin, classified_at = excluded.classified_at`

const upsertDescriptionStatement = `
   INSERT INTO xstock_description (ticker, word_count, description, sources, model, generated_at)
   VALUES ($ticker, $wordCount, $description, $sources, $model, $generatedAt)
   ON CONFLICT (ticker, word_count) DO UPDATE SET
      description = excluded.description, sources = excluded.sources,
      model = excluded.model, generated_at = excluded.generated_at`

const placeholders = (count) => Array(count).fill('?').join(', ')

const parseSources = (sources) => {
   if (!sources) return []
   try {
      const parsed = JSON.parse(sources)
      return Array.isArray(parsed) ? parsed : []
   }
   catch {
      return []
   }
}

export default function XStockRepository() {

   const db = getDatabase()

   this.findListings = function (tickers) {
      if (tickers.length === 0) return new Map()

      const rows = db.query(`
         SELECT ticker, altname, name, exchange, type, subtype, confidence, sources, origin,
                classified_at AS classifiedAt
         FROM xstock_listing
         WHERE ticker IN (${placeholders(tickers.length)})`).all(...tickers)

      return new Map(rows.map(row => [row.ticker, { ...row, sources: parseSources(row.sources) }]))
   }

   this.upsertListings = function (listings, classifiedAt) {

      const insert = db.prepare(upsertListingStatement)

      db.transaction(() => {
         for (const listing of listings) {
            insert.run({
               $ticker: listing.ticker,
               $altname: listing.altname ?? '',
               $name: listing.name ?? '',
               $exchange: listing.exchange ?? '',
               $type: listing.type ?? 'unknown',
               $subtype: listing.subtype ?? '',
               $confidence: listing.confidence ?? '',
               $sources: JSON.stringify(listing.sources ?? []),
               $origin: listing.origin ?? 'ai',
               $classifiedAt: classifiedAt
            })
         }
      })()
   }

   this.findDescriptions = function (tickers, wordCount) {
      if (tickers.length === 0) return new Map()

      const rows = db.query(`
         SELECT ticker, description, sources, generated_at AS generatedAt
         FROM xstock_description
         WHERE word_count = ? AND ticker IN (${placeholders(tickers.length)})`)
         .all(wordCount, ...tickers)

      return new Map(rows.map(row => [row.ticker, { ...row, sources: parseSources(row.sources) }]))
   }

   this.upsertDescriptions = function (descriptions, wordCount, model, generatedAt) {

      const insert = db.prepare(upsertDescriptionStatement)

      db.transaction(() => {
         for (const description of descriptions) {
            insert.run({
               $ticker: description.ticker,
               $wordCount: wordCount,
               $description: description.description,
               $sources: JSON.stringify(description.sources ?? []),
               $model: model,
               $generatedAt: generatedAt
            })
         }
      })()
   }

   this.clearListings = function () {
      db.exec('DELETE FROM xstock_listing')
   }

   this.clearDescriptions = function () {
      db.exec('DELETE FROM xstock_description')
   }
}
