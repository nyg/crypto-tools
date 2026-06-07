import { httpRequester } from '../http-requester/server-http-requester'

const apiUrl = 'https://www.binance.com/bapi/earn'
const urlFor = endpoint => apiUrl + endpoint

const simpleEarnProductsEndpoint = '/v1/friendly/finance-earn/simple/product/simpleEarnProducts'

export async function fetchSimpleEarnProducts(params) {
   return await httpRequester.public(urlFor(simpleEarnProductsEndpoint), params)
}
