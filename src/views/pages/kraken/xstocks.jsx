import { useState } from 'react'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import Section from '../../components/kraken/xstock-section'
import Checkbox from '../../components/lib/checkbox'
import Input from '../../components/lib/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2Icon } from 'lucide-react'


export default function KrakenETFs() {

   const { data, error, trigger, isMutating } = useSWRMutation('/api/kraken/xstocks')

   const [credentials, setCredentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('anthropic.api.key')) || ''
   }))

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
            <div className="text-sm text-muted-foreground">
               An Anthropic API key is required.
            </div>
         </KrakenLayout>
      )
   }

   let resultContent
   if (error) {
      resultContent = <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
   }
   else if (isMutating) {
      resultContent = <div className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" /> Fetching data…</div>
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
                  <Checkbox name="excludeStocks" label="Exclude stocks (ETFs only)" className="self-start" />
                  <Button type="submit" size="sm">
                     Fetch data
                  </Button>
               </div>
            </form>
            {resultContent}
         </div>
      </KrakenLayout>
   )
}
