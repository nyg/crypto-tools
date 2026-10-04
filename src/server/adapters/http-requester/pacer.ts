export function pacer(gapMs: number): () => Promise<void> {

   let next = 0

   return async () => {
      const now = Date.now()
      const wait = next - now
      next = Math.max(now, next) + gapMs
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
   }
}
