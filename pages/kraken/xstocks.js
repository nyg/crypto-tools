import { useEffect, useState } from 'react'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import Section from '../../components/kraken/xstock-section'


export default function KrakenETFs() {

   const { data, error, trigger, isMutating } = useSWRMutation('/api/kraken/xstocks')

   const [credentials, setCredentials] = useState(() => ({ apiKey: '' }))
   useEffect(() =>
      setCredentials({
         apiKey: localStorage.getItem('anthropic.api.key')
      }), [])

   let content
   if (error) {
      content = <div className="text-red-500">{error}</div>
   }
   else if (isMutating) {
      content = <div>Fetching data…</div>
   }
   else if (!data && !credentials.apiKey) {
      content = <div>An Anthropic API key is required.</div>
   }
   else if (!data) {
      content = <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded-sm hover:bg-gray-500" onClick={() => trigger({ credentials })}>
         Fetch data
      </button>
   }
   else {
      const etfs = data.output.filter(item => item.type === 'etf')
      const stocks = data.output.filter(item => item.type === 'stock')

      content = (
         <>
            {etfs.length > 0 && <Section title="Exchange-Traded Funds" items={etfs} icon="📊" />}
            {stocks.length > 0 && <Section title="Stocks" items={stocks} icon="📈" />}
            {data.length === 0 && <div>No data available</div>}
         </>
      )
   }

   return (
      <KrakenLayout name="xStocks">
         <div className="grow text-sm space-y-6 tabular-nums max-w-5xl">
            {content}
         </div>
      </KrakenLayout>
   )
}
