import { generateText, Output } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import KrakenAPI from '../../../adapters/kraken-api/adapter'
import UserService from '../../../core/services/user-service'


export default async function getETFs(req, res) {

   const { credentials } = req.body
   if (!credentials) {
      res.status(401).json({ error: 'No API credentials provided.' })
      return
   }

   try {
      const userService = new UserService(new KrakenAPI())
      const assets = await userService.fetchAssets('tokenized_asset')
      const xstocks = Object.keys(assets).filter(a => a.endsWith('x')).map(a => a.replace(/x$/, '')).join(', ')

      const anthropic = createAnthropic({ apiKey: credentials.apiKey })
      const { output, usage } = await generateText({
         model: anthropic('claude-haiku-4-5'),
         output: Output.object({
            schema: z.object({
               stocks: z.array(
                  z.object({
                     name: z.string().describe('Stock or ETF ticker'),
                     type: z.enum(['stock', 'etf']).describe('Whether this is a stock or ETF'),
                     description: z.string().describe('A description of the stock or ETF')
                  })
               )
            })
         }),
         prompt: `
         Using up-to-date information from reliable financial sources like Yahoo Finance, Bloomberg, or official company/ETF websites, analyze each ticker in the following list: ${xstocks}.
         For each:
         1. Classify it as a 'stock' (individual company shares) or 'ETF' (exchange-traded fund).
         2a. For ETFs, provide a detailed description of approximately 150 words targeted at investors. Include:
            - Background: fund objectives/holdings.
            - Key details: Sector/industry, market capitalization, recent performance (e.g., 1-year return), dividend yield (if applicable), P/E ratio, and major holdings or competitors.
            - Investment considerations: Potential risks (e.g., volatility, regulatory issues), growth opportunities, and why an investor might buy or avoid it.
         2b. For stocks, only a brief description of the company (20 words words max).
         If a ticker is invalid or ambiguous, note it as 'unknown' and explain briefly.
         `
      })

      res.status(200).json({
         output: output.stocks,
         usage
      })
   }
   catch (error) {
      if (error.message === 'HTTP Requester Error') {
         console.log('An error happened while contacting the Kraken API:', error.cause)
         res.status(500).json({ error: `An error happened while contacting the Kraken API: ${error.cause}` })
      }
      else {
         console.error('An unexpected error happened:', error)
         res.status(500).json({ error: 'An unexpected error happened.' })
      }

      return
   }
}
