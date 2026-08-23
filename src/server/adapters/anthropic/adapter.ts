import { streamText, Output } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type {
   AiActivityReporter, XStockAiListing, XStockDescription, XStockTarget
} from '../../../types/xstock'

export const MODEL = 'claude-sonnet-4-5'

export const SUBTYPES = [
   '', 'commodity-trust', 'leveraged', 'inverse', 'bond',
   'money-market', 'preferred', 'adr', 'closed-end-fund'
]

export const CLASSIFY_CHUNK_SIZE = 10
export const CLASSIFY_CONCURRENCY = 3
export const DESCRIBE_CONCURRENCY = 4

const listingSchema = z.object({
   ticker: z.string().describe('The requested ticker, echoed back exactly'),
   officialName: z.string().describe('Exact registered company or fund name, empty when unconfirmed'),
   listingExchange: z.string().describe('Exchange the security trades on, empty when unconfirmed'),
   type: z.enum(['stock', 'etf', 'unknown']),
   subtype: z.enum(SUBTYPES),
   confidence: z.enum(['high', 'low'])
})

const classificationRules = `
These tickers are the underlying securities behind Kraken's xStocks: tokenized equities issued by
Backed Finance. Kraken's asset code is the underlying ticker with a lowercase "x" appended
(AAPLx means AAPL, BRK.Bx means BRK.B). The "x" is Kraken's tokenization marker and is never part
of the ticker itself.

Identify each security as it is listed on its home exchange, which is almost always NASDAQ, NYSE,
NYSE Arca or Cboe BZX.

Rules:
* Use web search for any ticker you are not already certain of. The obscure ones are real listings,
  not typos, and guessing at them is the specific failure this task exists to avoid.
* Never resolve a ticker to a cryptocurrency, token or blockchain project, even when one of that
  name exists. Several of these collide with crypto assets and are equities here: BOT, SATA, TONX,
  VIDA, OPEN, NET, PL, V, MA.
* LNG is Cheniere Energy, a common stock, despite reading like a commodity fund.
* officialName must be the exact registered company or fund name. If web search cannot confirm it,
  return type "unknown" with an empty officialName and confidence "low". An honest unknown is more
  useful than a plausible guess.
* type is "stock" for any single-company equity, including preferred shares and ADRs. It is "etf"
  for any pooled exchange-traded product, including commodity trusts, leveraged and inverse
  products, and bond or money-market funds.
* subtype narrows that where it applies: "commodity-trust" for physically backed trusts such as
  GLD or SLV, "leveraged" or "inverse" for geared products, "bond" and "money-market" for fixed
  income funds, "preferred" for preferred shares, "adr" for depositary receipts,
  "closed-end-fund" for closed-end funds. Use "" when none applies.
* confidence is "high" only when the official name is confirmed.
* Return exactly one entry per requested ticker, echoing the ticker string verbatim. No additions,
  no omissions.`

const asSources = (content: unknown): string[] => {
   const urls = new Set<string>()
   for (const part of (content ?? []) as ContentPart[]) {
      if (part.type !== 'tool-result') continue
      for (const item of Array.isArray(part.output) ? part.output : []) {
         if (item?.url) urls.add(item.url)
      }
   }
   return [...urls]
}

export const chunked = <T>(items: T[], size: number): T[][] => {
   const chunks: T[][] = []
   for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size))
   }
   return chunks
}

type ContentPart = { type: string, output?: { url?: string }[] }

interface RunOptions {
   onActivity?: AiActivityReporter
   abortSignal?: AbortSignal
}

interface RunRequest<Schema extends z.ZodType> extends RunOptions {
   prompt: string
   schema: Schema
   maxSearches: number
}

export default class AnthropicAPI {

   readonly #anthropic: ReturnType<typeof createAnthropic>

   constructor(apiKey: string) {
      this.#anthropic = createAnthropic({ apiKey })
   }

   #webSearch(maxUses: number) {
      return {
         web_search: this.#anthropic.tools.webSearch_20260209({ maxUses })
      }
   }

   async #run<Schema extends z.ZodType>(
      { prompt, schema, maxSearches, onActivity, abortSignal }: RunRequest<Schema>
   ): Promise<{ output: z.infer<Schema>, sources: string[] }> {

      const result = streamText({
         model: this.#anthropic(MODEL),
         tools: this.#webSearch(maxSearches),
         output: Output.object({ schema }),
         prompt,
         abortSignal
      })

      const report = onActivity ?? (() => {})

      for await (const part of result.stream) {
         if ('toolName' in part && part.toolName === 'web_search') {
            if (part.type === 'tool-call') {
               report({ type: 'searching', query: String((part.input as { query?: string })?.query ?? '') })
            }
            else if (part.type === 'tool-result') report({ type: 'reading' })
         }
         else if (part.type === 'text-delta') report({ type: 'writing' })
      }

      // The SDK does not carry the schema's type through this wrapper's own generic,
      // so the shape is asserted here — Output.object is what validates it at runtime.
      const output = await result.output as z.infer<Schema>

      return { output, sources: asSources(await result.content) }
   }

   async classifyTickers(tickers: string[], { onActivity, abortSignal }: RunOptions = {}): Promise<XStockAiListing[]> {

      const { output, sources } = await this.#run({
         prompt: `Classify these ${tickers.length} tickers: ${tickers.join(', ')}.\n${classificationRules}`,
         schema: z.object({ listings: z.array(listingSchema) }),
         maxSearches: tickers.length + 4,
         onActivity,
         abortSignal
      })

      return (output?.listings ?? []).map(listing => ({ ...listing, sources }))
   }

   async describeListing(
      listing: XStockTarget, wordCount: number, { onActivity, abortSignal }: RunOptions = {}
   ): Promise<XStockDescription> {

      const { output, sources } = await this.#run({
         prompt: this.#describePrompt(listing, wordCount),
         schema: z.object({ description: z.string() }),
         maxSearches: 4,
         onActivity,
         abortSignal
      })

      return { ticker: listing.ticker, description: output?.description ?? '', sources }
   }

   #describePrompt(listing: XStockTarget, wordCount: number) {
      const identity = listing.name
         ? `${listing.ticker}, which is ${listing.name}${listing.exchange ? ` listed on ${listing.exchange}` : ''}`
         : listing.ticker

      const guidance = listing.type === 'etf'
         ? `Cover the fund's objective and what it holds, the index or sector it tracks, its scale and
            costs, notable concentrations among its largest positions, and the risks and opportunities
            an investor would weigh.`
         : `Cover what the company does and how it makes money, its sector and rough scale, recent
            performance, and the risks and opportunities an investor would weigh.`

      return `
         Write a description of ${identity} of approximately ${wordCount} words, aimed at an investor.

         This is the security underlying a Kraken xStock token; describe the underlying security
         itself, never the token or any similarly named cryptocurrency.

         ${guidance}

         Use web search so the details are current. Be descriptive and factual, not promotional, and
         do not give investment advice or make recommendations. Return prose only, with no heading,
         no bullet points and no ticker prefix.`
   }
}
