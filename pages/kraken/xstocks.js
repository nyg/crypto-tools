import { useEffect, useState } from 'react'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import Section from '../../components/kraken/xstock-section'
import Input from '../../components/lib/input'


export default function KrakenETFs() {

   const { data, error, trigger, isMutating } = useSWRMutation('/api/kraken/xstocks')

   const [credentials, setCredentials] = useState(() => ({ apiKey: '' }))
   useEffect(() =>
      setCredentials({
         apiKey: localStorage.getItem('anthropic.api.key')
      }), [])

   const fetchData = event => {
      event.preventDefault()
      const formData = new FormData(event.target)
      const excludeStocks = formData.get('excludeStocks') === 'on'
      const etfWordCount = parseInt(formData.get('etfWordCount'))
      trigger({ credentials, excludeStocks, etfWordCount })
   }

   if (!credentials.apiKey) {
      return (
         <KrakenLayout name="xStocks">
            <div className="text-sm">
               An Anthropic API key is required.
            </div>
         </KrakenLayout>
      )
   }

   let resultContent
   if (error) {
      resultContent = <div className="text-red-500">{error}</div>
   }
   else if (isMutating) {
      resultContent = <div>Fetching data…</div>
   }
   else if (data) {
      const etfs = data.output.filter(item => item.type === 'etf')
      const stocks = data.output.filter(item => item.type === 'stock')
      console.log(data.usage)
      resultContent = (
         <>
            {etfs.length > 0 && <Section title="Exchange-Traded Funds" items={etfs} icon="📊" />}
            {stocks.length > 0 && <Section title="Stocks" items={stocks} icon="📈" />}
            {data.output.length === 0 && <div>No data available</div>}
         </>
      )
   }

   return (
      <KrakenLayout name="xStocks">
         <div className="grow text-sm space-y-6 tabular-nums max-w-5xl">
            <form onSubmit={fetchData}>
               <div className="flex items-end gap-4">
                  <Input name="etfWordCount" type="number" label="ETF description word count" defaultValue="60" />
                  <Input name="excludeStocks" type="checkbox" label="Exclude stocks (ETFs only)" className="self-start" />
                  <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded-sm hover:bg-gray-500">
                     Fetch data
                  </button>
               </div>
            </form>
            {resultContent}
         </div>
      </KrakenLayout>
   )
}
