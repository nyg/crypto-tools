import * as format from '../utils/format'
import Head from 'next/head'
import Input from '../components/form/input'
import { useState } from 'react'


export default function Home() {

   const [content, setContent] = useState(<p>Provide a Binance API key and secret to start fetching your data.</p>)

   const onSubmit = async event => {

      event.preventDefault()

      const response = await fetch('/api/aggregate-balance', {
         method: 'POST',
         body: new URLSearchParams(new FormData(event.target))
      })

      if (response.status !== 200) {
         setContent(<p>Error, make sure your API key is correct</p>)
         return
      }

      const data = await response.json()

      setContent(<>
         {data.balance.map(({ asset, totalUSD, total, spot, staking }) => (
            <div key={asset} className="border border-gray-800 rounded p-2">
               <div className="pb-1">
                  <span className="font-bold">{asset}</span>, total $: {format.asDecimal(totalUSD)}, spot: {format.asDecimal(spot)}, staking: {format.asDecimal(staking?.balance)}
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
      </>)
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
