import { useState } from 'react'
import { Link } from 'react-router'
import useSWRMutation from 'swr/mutation'
import { Loader2Icon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import InfoBanner from '../../components/lib/info-banner'
import Section from '../../components/kraken/xstock-section'
import Checkbox from '../../components/lib/checkbox'
import NumericInput from '../../components/lib/numeric-input'
import { asCount } from '../../components/lib/filter-options'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'


export default function KrakenXStocks() {

   const { data, error, trigger, isMutating } = useSWRMutation('/api/kraken/xstocks')

   const [credentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('anthropic.api.key')) || ''
   }))

   const [etfWordCount, setEtfWordCount] = useState('60')

   const fetchData = event => {
      event.preventDefault()
      const formData = new FormData(event.target)
      const excludeStocks = formData.get('excludeStocks') === 'on'
      trigger({ credentials, excludeStocks, etfWordCount: parseInt(etfWordCount) }).catch(() => {})
   }

   if (!credentials.apiKey) {
      return (
         <KrakenLayout name="xStocks">
            <Alert>
               <AlertDescription>
                  Add an Anthropic API key in{' '}
                  <Link to="/settings" className="font-medium text-foreground underline underline-offset-4">
                     Settings
                  </Link>{' '}
                  to generate these summaries.
               </AlertDescription>
            </Alert>
         </KrakenLayout>
      )
   }

   const etfs = (data?.output ?? []).filter(item => item.type === 'etf')
   const stocks = (data?.output ?? []).filter(item => item.type === 'stock')

   let resultContent
   if (error) {
      resultContent = <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
   }
   else if (isMutating) {
      resultContent = (
         <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Asking Claude…
         </span>
      )
   }
   else if (!data) {
      resultContent = (
         <p className="text-sm text-muted-foreground">
            Nothing fetched yet — set the options above and select Fetch data.
         </p>
      )
   }
   else if (data.output.length === 0) {
      resultContent = <p className="text-sm text-muted-foreground">No tokenized stocks or ETFs were returned.</p>
   }
   else {
      resultContent = (
         <div className="space-y-6">
            {etfs.length > 0 && <Section title="Exchange-Traded Funds" items={etfs} />}
            {stocks.length > 0 && <Section title="Stocks" items={stocks} />}
         </div>
      )
   }

   return (
      <KrakenLayout name="xStocks">
         <div className="space-y-6">

            <InfoBanner>
               Kraken&apos;s tokenized stocks and ETFs, each with a short summary written by Claude
               from its own knowledge rather than from Kraken&apos;s listing text. Fetching sends a
               request billed to your Anthropic account, so the list is only built when you ask for
               it. The summaries are descriptive and are not investment advice.
            </InfoBanner>

            <Card size="sm">
               <CardHeader>
                  <CardTitle>Parameters</CardTitle>
               </CardHeader>
               <CardContent>
                  <form onSubmit={fetchData} className="space-y-4">
                     <div className="grid grid-cols-2 items-end gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
                        <NumericInput
                           name="etfWordCount"
                           label="ETF description word count"
                           value={etfWordCount}
                           onChange={(e) => setEtfWordCount(e.target.value)} />
                        <Checkbox
                           name="excludeStocks"
                           className="h-9"
                           label="Exclude stocks (ETFs only)" />
                     </div>
                     <Button type="submit" size="sm" disabled={isMutating}>
                        Fetch data
                     </Button>
                  </form>
               </CardContent>
            </Card>

            <Card>
               <CardHeader>
                  <CardTitle>Listings</CardTitle>
                  <CardAction>
                     {isMutating
                        ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                        : data && <Badge variant="outline">{asCount(data.output.length, 'listing')}</Badge>}
                  </CardAction>
               </CardHeader>
               <CardContent>
                  {resultContent}
               </CardContent>
            </Card>

         </div>
      </KrakenLayout>
   )
}
