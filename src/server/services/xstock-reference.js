import seed from '../data/xstocks.json'

export const isSeeded = (ticker) => Boolean(seed.listings[ticker])

export const seededListing = (ticker) => {
   const entry = seed.listings[ticker]
   return entry ? { ...entry, origin: 'seed', confidence: 'high', sources: [] } : null
}
