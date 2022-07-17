import * as format from '../utils/format'


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

function Product({ product }) {

   const duration = product.info.duration
   const apy = format.asPercentage(product.info.config.annualInterestRate)
   const userAmount = format.asDecimal(product.info.positionsAmount)
   const userLimit = format.asDecimal(product.info.config.maxPurchaseAmountPerUser)

   const availability = product.info.sellOut
      ? <span className="text-red-600">sold out</span>
      // : `remaining: ${format.asDecimal(Big(product.info.upLimit).minus(product.info.purchased))}`
      : <span className="text-green-600">available</span>

   return (
      <li>
         {duration} days @ {apy} · {userAmount} / {userLimit} · {availability}
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

               <div className="py-1 px-2">
                  <ul className="space-y-2">
                     {staking.products.map(product => <Product key={product.info.id} product={product} />)}
                  </ul>
               </div>
            </div>
         ))}
      </div>
   )
}
