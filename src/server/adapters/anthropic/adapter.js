import { generateText, Output } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'


export default function AnthropicAPI(apiKey) {

   this.classifyAssets = async function (tickers, excludeStocks, etfWordCount) {
      const anthropic = createAnthropic({ apiKey })
      return await generateText({
         model: anthropic('claude-sonnet-4-5'),
         output: Output.object({
            schema: z.object({
               stocks: z.array(
                  z.object({
                     name: z.string().describe('Stock or ETF ticker'),
                     type: z.enum(['stock', 'etf', 'unknown']).describe('Whether this is a stock or ETF'),
                     description: z.string().describe('A description of the stock or ETF')
                  })
               )
            })
         }),
         prompt: stocksClassificationPrompt(tickers, excludeStocks, etfWordCount)
      })
   }

   const stocksClassificationPrompt = (xstocks, excludeStocks, etfWordCount) => {
      const stocksPrompt = excludeStocks
         ? 'ignore the ticker completely and do not return it in the output data'
         : 'only provide a brief description of the company (20 words words max)'

      return `
         For each of the following tickers: ${xstocks}:
         * Using web search, find out if it is a 'stock' or an 'ETF'. The ticker symbol must match exactly! If you cannot verify or are unsure, mark it as 'unknown'.
         * For 'unknown' tickers, do not provide a description;
         * For stocks, ${stocksPrompt};
         * For ETFs, provide a detailed and up-to-date description of approximately ${etfWordCount} words targeted at investors. Include:
            - Background information such as fund objectives, holdings, etc.,
            - Key details: Sector, industry, market capitalization, recent performance, dividend yield (if applicable) and major holdings or competitors,
            - Investment considerations: Potential risks, growth opportunities, and why an investor might buy or avoid it.`
   }

}
