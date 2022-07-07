import * as format from '../utils/format'
import ApiForm from '../components/api-form'
import eventBus from '../utils/event-bus'
import Head from 'next/head'
import Menu from '../components/menu'
import { useEffect } from 'react'
import useSWRMutation from 'swr/mutation'


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
         <caption>Next redemptions</caption>
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
         <div className="space-y-4">{list}</div>
      </>
   }

   useEffect(() => eventBus.on('api.form.submitted', trigger), [])

   return (
      <div>
         <Head>
            <title>Binance Staking Overview</title>
            <meta name="description" content="Binance Staking Overview" />
            <link rel="icon" href="/favicon.ico" />
         </Head>

         <main className="flex flex-col px-12 pb-12">
            <header className="pl-3 mt-4 mb-4 flex items-baseline gap-x-3">
               <h1 className="text-xl">Binance Staking Overview</h1>
               <span className="flex-grow"></span>
               <Menu />
            </header>

            <section className="flex-grow text-sm space-y-6">
               <ApiForm />

               <div className="space-y-4">
                  {content}
               </div>
            </section>
         </main>
      </div>
   )
}

async function sendRequest(url, { arg: body }) {
   // to check for error handling:
   // https://github.com/ElvenTools/elven-tools-dapp/blob/85013df2eacac974804c345434c432447c112f64/utils/apiCall.ts
   return (await fetch(url, { method: 'POST', body })).json()
}
