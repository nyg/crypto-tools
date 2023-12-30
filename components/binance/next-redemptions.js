import * as format from '../../utils/format'


export default function NextRedemptions({ data }) {

   const positions = data.balance.flatMap(b => b.staking.positions)
   positions.sort((p, q) => p.deliverDate - q.deliverDate)

   return (
      <div className="w-1/3 h-32 overflow-auto">
         <table className="w-full text-right">
            <caption>Next redemptions</caption>
            <thead>
               <tr>
                  <th className="text-left">Asset</th>
                  <th>Amount</th>
                  <th>APY</th>
                  <th>Duration</th>
                  <th>Redemption date</th>
               </tr>
            </thead>
            <tbody>
               {positions.map(position => (
                  <tr key={position.positionId}>
                     <td className="text-left">{position.asset}</td>
                     <td>{format.asDecimal(position.amount)}</td>
                     <td>{format.asPercentage(position.apy)}</td>
                     <td>{position.accrualDays} of {position.duration}</td>
                     <td>{format.asLongDate(position.deliverDate)}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   )
}
