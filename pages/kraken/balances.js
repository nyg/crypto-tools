import { useState } from 'react'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import { asDecimal } from '../../utils/format'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2Icon } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'


export default function KrakenBalances() {

   const { data, error, trigger, isMutating } = useSWRMutation('/api/kraken/balances')

   const [credentials, setCredentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.key')) || '',
      apiSecret: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.secret')) || ''
   }))

   let content
   if (error) {
      content = <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
   }
   else if (isMutating) {
      content = <div className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" /> Fetching data…</div>
   }
   else if (!data && !credentials.apiKey) {
      content = <div>Generate an API key and secret on Kraken to be able to fetch your spot and staking balance.</div>
   }
   else if (!data) {
      content = <Button size="sm" onClick={() => trigger({ credentials })}>
         Fetch data
      </Button>
   }
   else {
      content = (
         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead className="text-left">Asset</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {Object.keys(data).map(asset =>
                  <TableRow key={asset}>
                     <TableCell className="pr-8">{asset}</TableCell>
                     <TableCell className="text-right tabular-nums">{asDecimal(Number.parseFloat(data[asset]), 18)}</TableCell>
                  </TableRow>)}
            </TableBody>
         </Table>
      )
   }

   return (
      <KrakenLayout name="Balance">
         <div className="grow text-sm space-y-6 tabular-nums">
            {content}
         </div>
      </KrakenLayout>
   )
}
