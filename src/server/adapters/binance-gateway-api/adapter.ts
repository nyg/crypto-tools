import { fetchSimpleEarnProducts } from './resource'
import type { StakingProducts } from '../../../types/binance'

export default class BinanceGatewayAPI {

   async fetchStakingProducts(): Promise<StakingProducts> {

      let hasNext = true, pageIndex = 1, fetchedProductCount = 0
      let allProducts: StakingProducts = {}

      while (hasNext) {
         const params = { pageIndex, pageSize: 500, simpleEarnType: 'FIXED' }
         const response = await fetchSimpleEarnProducts(params)

         fetchedProductCount += response.data.list.length
         hasNext = fetchedProductCount < response.data.total
         pageIndex++

         const products = response.data.list.reduce<StakingProducts>((map, product) => ({
            ...map,
            [product.asset]: product.productDetailList
               .map(detail => ({
                  id: detail.productId,
                  apy: detail.apy,
                  duration: detail.duration,
                  soldOut: detail.sellOut,
                  minStakingAmount: detail.minPurchaseAmount,
                  maxStakingAmount: detail.maxPurchaseAmountPerUser
               }))
         }), {})

         allProducts = { ...allProducts, ...products }
      }

      return allProducts
   }
}
