interface Cached<T> {
   value: Promise<T>
   expiresAt: number
}

export default class CacheMap<T> {

   readonly #ttl: number
   readonly #entries = new Map<string, Cached<T>>()

   constructor(ttl: number) {
      this.#ttl = ttl
   }

   get(key: string, load: () => Promise<T>): Promise<T> {
      const entry = this.#entries.get(key)
      if (entry && entry.expiresAt > Date.now()) return entry.value

      const value = load()
      const fresh = { value, expiresAt: Date.now() + this.#ttl }
      value.catch(() => { fresh.expiresAt = 0 })
      this.#entries.set(key, fresh)
      return value
   }
}
