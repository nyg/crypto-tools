// A caught value is `unknown`, and almost every catch here only wants something to
// print. Reaching for error.message directly would be a type error on each one.
export function messageOf(error: unknown): string {
   if (error instanceof Error) return error.message
   return String(error)
}

// Raised by the HTTP requester for anything an exchange refused, carrying what it
// answered. Routes report a Kraken or Binance failure differently from a bug, and
// this is what tells them apart.
export class HttpRequesterError extends Error {
   readonly statusCode: number
   readonly body: unknown

   constructor(statusCode: number, body: unknown) {
      super('HTTP Requester Error', { cause: JSON.stringify(body) })
      this.name = 'HttpRequesterError'
      this.statusCode = statusCode
      this.body = body
   }
}
