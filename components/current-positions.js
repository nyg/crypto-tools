import * as format from '../utils/format'
import Big from 'big.js'


function LabeledValue({ label, value, className }) {
   return (
      <span className={`flex space-x-2 text-xs leading-5 ${className}`}>
         <span className="flex-grow text-right font-medium">{value}</span>
         {label && (
            <span className="font-light uppercase">{label}</span>
         )}
      </span>
   )
}

function Product({ product, spot }) {

   const duration = product.info.duration
   const apy = format.asPercentage(product.info.apy)

   const productAvailable = !product.info.sellOut
   const userQuota = Big(product.info.maxPurchaseAmountPerUser)
   const userQuotaRemaining = userQuota.minus(product.info.positionsAmount)

   const buildAvailability = () => {

      if (productAvailable) {
         if (spot.gt(userQuotaRemaining)) {
            if (userQuotaRemaining.eq(0)) {
               return <span className="text-red-600">available but user quota of {format.asDecimal(userQuota)} {product.info.asset} reached</span>
            }
            if (userQuotaRemaining.lt(product.info.minPurchaseAmount)) {
               return <span className="text-red-600">available but remaining user quota too low</span>
            }
            else {
               return <span className="text-orange-400">available but user quota remaining is {format.asDecimal(userQuotaRemaining)} {product.info.asset}</span>
            }
            // }
         }
         else {
            return <span className="text-green-600">available</span>
         }
      }
      else {
         if (userQuotaRemaining.eq(0)) {
            return <span className="text-red-600">sold out and user quota of {format.asDecimal(userQuota)} {product.info.asset} reached</span>
         }
         if (userQuotaRemaining.lt(product.info.minPurchaseAmount)) {
            return <span className="text-red-600">sold out and user quota too low</span>
         }
         else if (spot.gt(userQuotaRemaining)) {
            return <span className="text-red-600">sold out and user quota remaining is {format.asDecimal(userQuotaRemaining)}</span>
         }
         else {
            return <span className="">sold out</span>
         }
      }
   }

   return (
      <li>
         {duration} days @ {apy} · {buildAvailability()}
         <ul className="text-xs pl-6">
            {product.positions.map(position => <Position key={position.positionId} position={position} />)}
         </ul>
      </li >
   )
}

function Position({ position }) {

   const amount = format.asDecimal(position.amount)
   const apy = format.asPercentage(position.apy)
   const daysRemaining = position.duration - position.accrualDays

   return (
      <li>{amount} @ {apy} · ends in {daysRemaining} days on {format.asLongDate(new Date(position.deliverDate))}</li>
   )
}

export default function CurrentPositions({ data }) {

   return (
      <div className="space-y-6">
         {data.balance.map(({ asset, free, locked, staking, total, fiatValue }) => (
            <div key={asset}>

               <div className="flex py-1 px-2 border-y border-gray-700">
                  <span className="w-[4%] font-bold">{asset}</span>
                  <LabeledValue className="w-[12%]" label="spot" value={format.asDecimal(free)} />
                  <LabeledValue className="w-[12%]" label="staking" value={format.asDecimal(staking?.balance)} />
                  <LabeledValue className="w-[12%]" label="locked" value={format.asDecimal(locked)} />
                  <LabeledValue className="w-[12%]" label="total" value={format.asDecimal(total)} />
                  <span className="flex-grow"></span>
                  <LabeledValue value={format.asDollarAmount(fiatValue)} />
               </div>

               {staking.products.length != 0 && (
                  <div className="py-1 px-2">
                     <ul className="space-y-2">
                        {staking.products.map(product => <Product key={product.info.productId} product={product} spot={Big(free)} />)}
                     </ul>
                  </div>
               )}
            </div>
         ))}
      </div>
   )
}
