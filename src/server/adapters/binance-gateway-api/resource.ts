import { httpRequester } from '../http-requester/server-http-requester'
import type { BinanceSimpleEarnParams, BinanceSimpleEarnProducts } from '../../../types/binance-api'

const apiUrl = 'https://www.binance.com/bapi/earn'
const urlFor = (endpoint: string) => apiUrl + endpoint

const simpleEarnProductsEndpoint = '/v1/friendly/finance-earn/simple/product/simpleEarnProducts'

export async function fetchSimpleEarnProducts(params: BinanceSimpleEarnParams): Promise<BinanceSimpleEarnProducts> {
   return await httpRequester.public<BinanceSimpleEarnProducts>(urlFor(simpleEarnProductsEndpoint), { ...params })
}
