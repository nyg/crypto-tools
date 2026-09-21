import seed from '../data/xstocks.json'
import productSeed from '../data/xstock-products.json'
import type { XStockProduct, XStockReference } from '../../types/xstock'

const listings = seed.listings as Record<string, Omit<XStockReference, 'origin' | 'confidence' | 'sources'>>

const products = productSeed.products as Record<string, { symbol: string, isin: string, underlyingIsin: string, slug: string }>

export const isSeeded = (ticker: string): boolean => Boolean(listings[ticker])

export const seededListing = (ticker: string): XStockReference | null => {
   const entry = listings[ticker]
   return entry ? { ...entry, origin: 'seed', confidence: 'high', sources: [] } : null
}

export const backedProduct = (ticker: string): XStockProduct | null => {
   const entry = products[ticker]
   return entry
      ? {
         isin: entry.isin,
         underlyingIsin: entry.underlyingIsin,
         productUrl: entry.slug ? `https://assets.backed.fi/products/${entry.slug}` : '',
         factsheetUrl: `https://documents.backed.fi/backed-assets-factsheet-${entry.symbol}.pdf`
      }
      : null
}
