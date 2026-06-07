import { fetchSimpleEarnProducts } from './resource'

export default function BinanceGatewayAPI() {

   this.fetchStakingProducts = async function () {

      let hasNext = true, pageIndex = 1, fetchedProductCount = 0
      let allProducts = {}

      while (hasNext) {
         const params = { pageIndex, pageSize: 500, simpleEarnType: 'FIXED' }
         const response = await fetchSimpleEarnProducts(params)

         fetchedProductCount += response.data.list.length
         hasNext = fetchedProductCount < response.data.total
         pageIndex++

         const products = response.data.list.reduce((map, product) => ({
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
