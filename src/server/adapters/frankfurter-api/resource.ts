import { httpRequester } from '../http-requester/server-http-requester'
import type { FrankfurterRate } from '../../../types/frankfurter-api'

const apiUrl = 'https://api.frankfurter.dev'
const urlFor = (endpoint: string) => apiUrl + endpoint

const ratesEndpoint = '/v2/rates'

export async function fetchRates({ from, to, base, quotes }: {
   from: string
   to: string
   base: string
   quotes: string[]
}): Promise<FrankfurterRate[]> {
   return await httpRequester.public(urlFor(ratesEndpoint), { from, to, base, quotes: quotes.join(',') })
}
