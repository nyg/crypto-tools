import { useState } from 'react'
import useSWRMutation from 'swr/mutation'
import CurrentPositions from '../../components/binance/current-positions'
import NextRedemptions from '../../components/binance/next-redemptions'
import BinanceLayout from '../../components/binance/binance-layout'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2Icon } from 'lucide-react'


export default function BinanceStaking() {

   const { data, error, isMutating, trigger: fetchAggregatedBalance } = useSWRMutation('/api/binance/aggregate-balance')

   const [credentials, setCredentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('binance.api.key')) || '',
      apiSecret: (typeof window !== 'undefined' && localStorage.getItem('binance.api.secret')) || ''
   }))

   const fetchDataButton = <Button size="sm" onClick={() => fetchAggregatedBalance({ credentials })}>
      Fetch data
   </Button>

   let content
   if (error) {
      content = <>
         <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
         </Alert>
         {fetchDataButton}
      </>
   }
   else if (isMutating) {
      content = <div className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" /> Fetching data…</div>
   }
   else if (!data && !credentials.apiKey) {
      content = <div>Generate an API key and secret on Binance to be able to fetch your spot and staking balance.</div>
   }
   else if (!data) {
      content = fetchDataButton
   }
   else {
      content = <>
         <NextRedemptions data={data} />
         <CurrentPositions data={data} />
      </>
   }

   return (
      <BinanceLayout name="Staking">
         <div className="grow text-sm space-y-4 tabular-nums">
            {content}
         </div>
      </BinanceLayout>
   )
}
