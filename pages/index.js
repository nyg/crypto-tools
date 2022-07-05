import * as format from '../utils/format'
import Head from 'next/head'
import Input from '../components/form/input'
import useSWRMutation from 'swr/mutation'


async function sendRequest(url, { arg: body }) {
   // check https://github.com/ElvenTools/elven-tools-dapp/blob/85013df2eacac974804c345434c432447c112f64/utils/apiCall.ts
   return (await fetch(url, { method: 'POST', body })).json()
}

export default function Home() {

   const { data, error, trigger, isMutating } = useSWRMutation('/api/aggregate-balance', sendRequest)

   let content
   if (error) {
      content = <div>{error}</div>
   }
   else if (isMutating) {
      content = <div>data is loading</div>
   }
   else if (!data) {
      content = <div>submit the form</div>
   }
   else {
      console.log(data)

      const positions = data.balance.flatMap(b => b.staking.positions)
      positions.sort((p, q) => p.deliverDate - q.deliverDate)

      console.log(positions)

      const table = <table className="w-1/3">
         <thead>

         </thead>
         <tbody className="text-right">
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

      const list = <>
         {data.balance.map(({ asset, totalUSD, total, spot, staking }) => (
            <div key={asset} className="border border-gray-800 rounded p-2">
               <div className="pb-1">
                  <span className="font-bold">{asset}</span> ${format.asDecimal(totalUSD)} (spot: {format.asDecimal(spot)}, staking: {format.asDecimal(staking?.balance)})
               </div>
               <div className="border-t border-gray-400 pt-1 pb-1">
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
      </>

      content = <>
         <div>{table}</div>
         <div>{list}</div>
      </>
   }

   const onSubmit = async event => {
      event.preventDefault()
      trigger(new URLSearchParams(new FormData(event.target)))
   }

   return (
      <div>
         <Head>
            <title>Binance Staking Overview</title>
            <meta name="description" content="Binance Staking Overview" />
            <link rel="icon" href="/favicon.ico" />
         </Head>

         <main className="text-sm space-y-4 p-4">
            <form method="post" onSubmit={onSubmit}>
               <div className="flex items-end gap-x-3">
                  <Input className="flex-grow" name="apiKey" label="API Key" defaultValue={process.env.NEXT_PUBLIC_BINANCE_API_KEY} />
                  <Input className="flex-grow" name="apiSecret" label="API Secret" defaultValue={process.env.NEXT_PUBLIC_BINANCE_API_SECRET} type="password" />
                  <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500">Fetch</button>
               </div>
            </form>

            <div className="space-y-4">
               {content}
            </div>
         </main>
      </div>
   )
}
