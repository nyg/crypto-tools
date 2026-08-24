import { Link } from 'react-router'
import useMutation from '../../lib/use-mutation'
import { Loader2Icon, RefreshCwIcon } from 'lucide-react'
import BinanceLayout from '../../components/binance/binance-layout'
import CurrentPositions from '../../components/binance/current-positions'
import NextRedemptions from '../../components/binance/next-redemptions'
import StakingProducts from '../../components/binance/staking-products'
import { useProvider } from '../../lib/use-settings'
import CredentialsAlert from '../../components/lib/credentials-alert'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { messageOf } from '../../lib/errors'
import type { AggregateBalanceResponse } from '../../../types/api'


export default function BinanceStaking() {

   const { data, error, isMutating, trigger } = useMutation<AggregateBalanceResponse>('/api/binance/aggregate-balance')

   const { configured, unreachable, isLoading: isLoadingSettings } = useProvider('binance')

   const fetchData = () => trigger().catch(() => {})

   if (!isLoadingSettings && (unreachable || !configured)) {
      return (
         <BinanceLayout name="Staking">
            <CredentialsAlert unreachable={unreachable}>
               Generate an API key and secret on Binance and add them in{' '}
               <Link to="/settings" className="font-medium text-foreground underline underline-offset-4">
                  Settings
               </Link>{' '}
               to fetch your staking positions.
            </CredentialsAlert>
         </BinanceLayout>
      )
   }

   const fetchButton = (
      <Button size="sm" onClick={fetchData} disabled={isMutating}>
         {isMutating
            ? <Loader2Icon className="animate-spin" />
            : <RefreshCwIcon />}
         {data ? 'Refresh' : 'Fetch data'}
      </Button>
   )

   let content
   if (isMutating && !data) {
      content = (
         <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Fetching from Binance…
         </span>
      )
   }
   else if (!data) {
      content = (
         <p className="text-sm text-muted-foreground">
            Nothing fetched yet — select Fetch data to read your balances from Binance.
         </p>
      )
   }
   else {
      content = <CurrentPositions data={data} />
   }

   return (
      <BinanceLayout name="Staking">
         <div className="space-y-6">

            {Boolean(error) &&
               <Alert variant="destructive">
                  <AlertDescription>{messageOf(error)}</AlertDescription>
               </Alert>}

            <Card>
               <CardHeader>
                  <CardTitle>Holdings</CardTitle>
                  <CardAction>{fetchButton}</CardAction>
               </CardHeader>
               <CardContent>
                  {content}
               </CardContent>
            </Card>

            {data &&
               <Card>
                  <CardHeader>
                     <CardTitle>Next redemptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <NextRedemptions data={data} />
                  </CardContent>
               </Card>}

            {data &&
               <Card>
                  <CardHeader>
                     <CardTitle>Staking products</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <StakingProducts data={data} />
                  </CardContent>
               </Card>}

         </div>
      </BinanceLayout>
   )
}
