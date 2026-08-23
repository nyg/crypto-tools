import seed from '../data/xstocks.json'
import type { XStockReference } from '../../types/xstock'

const listings = seed.listings as Record<string, Omit<XStockReference, 'origin' | 'confidence' | 'sources'>>

export const isSeeded = (ticker: string): boolean => Boolean(listings[ticker])

export const seededListing = (ticker: string): XStockReference | null => {
   const entry = listings[ticker]
   return entry ? { ...entry, origin: 'seed', confidence: 'high', sources: [] } : null
}
