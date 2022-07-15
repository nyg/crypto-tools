import * as format from '../utils/format'

function LabeledValue({ label, value, className }) {
   return (
      <span className={`flex space-x-2 text-xs leading-5 ${className}`}>
         <span className="flex-grow text-right font-medium">{value}</span>
         {label && (
            <span className="font-light uppercase tabular-nums">{label}</span>
         )}
      </span>
   )
}

export default function CurrentPositions({ data }) {

   return (
      <div className="space-y-6">
         {data.balance.map(({ asset, totalUSD, total, spot, staking }) => (
            <div key={asset}>

               <div className="flex py-1 px-2 border-y border-gray-700">
                  <span className="w-[4%] font-bold">{asset}</span>
                  <LabeledValue className="w-[12%]" label="total" value={format.asDecimal(total)} />
                  <LabeledValue className="w-[12%]" label="spot" value={format.asDecimal(spot)} />
                  <LabeledValue className="w-[12%]" label="staking" value={format.asDecimal(staking?.balance)} />
                  <span className="flex-grow"></span>
                  <LabeledValue value={format.asDollarAmount(totalUSD)} />
               </div>

               <div className="pt-1 pb-1">
                  {staking.positions.map(position => (
                     <div key={position.positionId}>
                        <span>{position.accrualDays} of {position.duration} days, </span>
                        <span>{format.asPercentage(position.apy)} on {format.asDecimal(position.amount)}, </span>
                        <span>ends on {format.asLongDate(new Date(position.deliverDate))}</span>
                     </div>
                  ))}
               </div>

               <div className="border-t border-gray-400 pt-1">
                  {staking.products.map(product => (
                     <div key={product.id}>
                        <span>{product.sellOut ? 'Sold out!' : 'Available'}, </span>
                        <span>{product.duration} days, {format.asPercentage(product.config.annualInterestRate)}, </span>
                        <span>user limit: {format.asDecimal(product.config.maxPurchaseAmountPerUser)}</span>
                     </div>
                  ))}
               </div>
            </div>
         ))}
      </div>
   )
}
