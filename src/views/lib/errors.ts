// A caught value is `unknown`, and the views only ever want something to print.
// The server has its own copy; sharing one would drag the browser bundle across the
// runtime boundary for four lines.
export function messageOf(error: unknown): string {
   if (error instanceof Error) return error.message
   return String(error)
}
