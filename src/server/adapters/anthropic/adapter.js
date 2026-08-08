import { generateText, Output } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

export const MODEL = 'claude-sonnet-4-5'

export const SUBTYPES = [
   '', 'commodity-trust', 'leveraged', 'inverse', 'bond',
   'money-market', 'preferred', 'adr', 'closed-end-fund'
]

const CLASSIFY_CHUNK_SIZE = 10
const CLASSIFY_CONCURRENCY = 3
const DESCRIBE_CONCURRENCY = 4

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

const asSources = (result) => {
   const urls = new Set()
   for (const part of result.content ?? []) {
      if (part.type !== 'tool-result') continue
      for (const item of Array.isArray(part.output) ? part.output : []) {
         if (item?.url) urls.add(item.url)
      }
   }
   return [...urls]
}

const inBatches = async (items, size, worker) => {
   const results = []
   for (let index = 0; index < items.length; index += size) {
      results.push(...await Promise.all(items.slice(index, index + size).map(worker)))
   }
   return results
}

export default function AnthropicAPI(apiKey) {

   const anthropic = createAnthropic({ apiKey })

   const webSearch = (maxUses) => ({
      web_search: anthropic.tools.webSearch_20260209({ maxUses })
   })

   this.classifyListings = async function (tickers) {

      const chunks = []
      for (let index = 0; index < tickers.length; index += CLASSIFY_CHUNK_SIZE) {
         chunks.push(tickers.slice(index, index + CLASSIFY_CHUNK_SIZE))
      }

      const chunkResults = await inBatches(chunks, CLASSIFY_CONCURRENCY, async (chunk) => {

         const result = await generateText({
            model: anthropic(MODEL),
            tools: webSearch(chunk.length + 4),
            output: Output.object({ schema: z.object({ listings: z.array(listingSchema) }) }),
            prompt: `Classify these ${chunk.length} tickers: ${chunk.join(', ')}.\n${classificationRules}`
         })

         const sources = asSources(result)
         return (result.output?.listings ?? []).map(listing => ({ ...listing, sources }))
      })

      return chunkResults.flat()
   }

   this.describeListings = async function (listings, wordCount) {

      return await inBatches(listings, DESCRIBE_CONCURRENCY, async (listing) => {

         const result = await generateText({
            model: anthropic(MODEL),
            tools: webSearch(4),
            output: Output.object({ schema: z.object({ description: z.string() }) }),
            prompt: describePrompt(listing, wordCount)
         })

         return {
            ticker: listing.ticker,
            description: result.output?.description ?? '',
            sources: asSources(result)
         }
      })
   }

   const describePrompt = (listing, wordCount) => {
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
