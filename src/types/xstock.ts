export type XStockType = 'stock' | 'etf' | 'unknown'

// What the listings route reports for a ticker nothing has classified yet.
export type XStockListingType = XStockType | 'unclassified'

export interface XStockClassification {
   ticker: string
   altname: string
   name: string
   exchange: string
   type: XStockType
   subtype: string
   confidence: string
   sources: string[]
   origin: string
}

// A ticker's reference entry, however it was established: seeded from the checked-in
// data file, or classified by Claude and stored.
export interface XStockReference {
   name: string
   exchange: string
   type: XStockType
   subtype: string
   confidence: string
   origin: string
   sources: string[]
}

export interface XStockDescription {
   ticker: string
   description: string
   sources: string[]
}

// The identity Claude is asked to describe, rather than the full stored listing.
export interface XStockTarget {
   ticker: string
   name: string
   exchange: string
   type: XStockType
   subtype: string
}

export interface XStockAiListing {
   ticker: string
   officialName: string
   listingExchange: string
   type: XStockType
   subtype: string
   confidence: string
   sources?: string[]
}

export type AiActivity =
   | { type: 'searching', query: string }
   | { type: 'reading' }
   | { type: 'writing' }

export type AiActivityReporter = (activity: AiActivity) => void
