import type { Database, SQLQueryBindings } from 'bun:sqlite'
import { getDatabase } from './database'
import type { XStockDescriptionRow, XStockListingRow } from '../../types/db'
import type { XStockClassification, XStockDescription } from '../../types/xstock'

type Params = SQLQueryBindings[]
type NamedParams = Record<string, string | number | bigint | boolean | null>

export type StoredListing = Omit<XStockListingRow, 'sources'> & { sources: string[] }
export type StoredDescription = Omit<XStockDescriptionRow, 'sources'> & { sources: string[] }

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

const placeholders = (count: number) => Array(count).fill('?').join(', ')

const parseSources = (sources: string): string[] => {
   if (!sources) return []
   try {
      const parsed: unknown = JSON.parse(sources)
      return Array.isArray(parsed) ? parsed as string[] : []
   }
   catch {
      return []
   }
}

export default class XStockRepository {

   readonly #db: Database

   constructor() {
      this.#db = getDatabase()
   }

   findListings(tickers: string[]): Map<string, StoredListing> {
      if (tickers.length === 0) return new Map()

      const rows = this.#db.query<XStockListingRow, Params>(`
         SELECT ticker, altname, name, exchange, type, subtype, confidence, sources, origin,
                classified_at AS classifiedAt
         FROM xstock_listing
         WHERE ticker IN (${placeholders(tickers.length)})`).all(...tickers)

      return new Map(rows.map(row => [row.ticker, { ...row, sources: parseSources(row.sources) }]))
   }

   upsertListings(listings: XStockClassification[], classifiedAt: number): void {

      const insert = this.#db.prepare<void, NamedParams>(upsertListingStatement)

      this.#db.transaction(() => {
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

   findDescriptions(tickers: string[], wordCount: number): Map<string, StoredDescription> {
      if (tickers.length === 0) return new Map()

      const rows = this.#db.query<XStockDescriptionRow, Params>(`
         SELECT ticker, description, sources, generated_at AS generatedAt
         FROM xstock_description
         WHERE word_count = ? AND ticker IN (${placeholders(tickers.length)})`)
         .all(wordCount, ...tickers)

      return new Map(rows.map(row => [row.ticker, { ...row, sources: parseSources(row.sources) }]))
   }

   upsertDescriptions(descriptions: XStockDescription[], wordCount: number, model: string, generatedAt: number): void {

      const insert = this.#db.prepare<void, NamedParams>(upsertDescriptionStatement)

      this.#db.transaction(() => {
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

   clearListings(): void {
      this.#db.exec('DELETE FROM xstock_listing')
   }

   clearDescriptions(): void {
      this.#db.exec('DELETE FROM xstock_description')
   }
}
