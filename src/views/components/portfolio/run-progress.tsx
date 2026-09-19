import { useEffect, useRef } from 'react'
import useSWR from 'swr'
import { Loader2Icon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { asQuantity, asQuoteAmount, orderStatusLabels, runStatusLabels } from './format'
import type { PortfolioRun, PortfolioRunRequest, PortfolioRunResponse } from '../../../types/api'
import type { RunOrderStatus } from '../../../types/portfolio'

const badgeVariant = (status: RunOrderStatus) =>
   status === 'filled' ? 'secondary' : ['rejected', 'failed'].includes(status) ? 'destructive' : 'outline'

export function RunOrdersTable({ run, quoteAsset }: { run: PortfolioRun, quoteAsset: string }) {
   return (
      <Table className="tabular-nums">
         <TableHeader>
            <TableRow>
               <TableHead>Order</TableHead>
               <TableHead className="text-right">Requested</TableHead>
               <TableHead className="text-right">Filled</TableHead>
               <TableHead className="text-right">For</TableHead>
               <TableHead className="text-right">Fees</TableHead>
               <TableHead>Status</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {run.orders.map(order => {
               const base = order.symbol.replace(new RegExp(`${quoteAsset}$`), '')
               return (
                  <TableRow key={order.orderLinkId}>
                     <TableCell className="font-medium capitalize">{order.side} {base}</TableCell>
                     <TableCell className="text-right">
                        {asQuantity(order.requested)} {order.unit === 'base' ? base : quoteAsset}
                     </TableCell>
                     <TableCell className="text-right">{asQuantity(order.base)} {base}</TableCell>
                     <TableCell className="text-right">{asQuoteAmount(order.quote, quoteAsset)}</TableCell>
                     <TableCell className="text-right text-muted-foreground">
                        {order.fees.length === 0 ? '—' : order.fees.map(fee => `${asQuantity(fee.amount)} ${fee.asset}`).join(', ')}
                     </TableCell>
                     <TableCell>
                        <Badge variant={badgeVariant(order.status)} title={order.error ?? undefined}>
                           {orderStatusLabels[order.status]}
                        </Badge>
                        {order.error && <div className="mt-1 max-w-56 text-xs whitespace-normal text-muted-foreground">{order.error}</div>}
                     </TableCell>
                  </TableRow>
               )
            })}
         </TableBody>
      </Table>
   )
}

interface RunProgressProps {
   apiBase: string
   runId: string
   quoteAsset: string
   onDone?: (run: PortfolioRun) => void
}

export default function RunProgress({ apiBase, runId, quoteAsset, onDone }: RunProgressProps) {

   const key: [string, PortfolioRunRequest] = [`${apiBase}/run`, { runId }]
   const { data, error } = useSWR<PortfolioRunResponse>(key, {
      refreshInterval: latest => latest?.run.running ? 1000 : 0,
      dedupingInterval: 0,
      revalidateOnFocus: false
   })

   const reported = useRef(false)
   const run = data?.run

   useEffect(() => {
      if (!run || run.running || reported.current) return
      reported.current = true
      onDone?.(run)
   }, [run])

   if (error) {
      return (
         <Alert variant="destructive">
            <AlertDescription>{String(error)}</AlertDescription>
         </Alert>
      )
   }

   if (!run) return <Loader2Icon className="size-5 animate-spin text-muted-foreground" />

   const settled = run.orders.filter(({ status }) => !['pending', 'placed', 'unknown'].includes(status)).length

   return (
      <div className="space-y-3">
         <div className="flex items-center gap-2 text-sm">
            {run.running && <Loader2Icon className="size-4 animate-spin" />}
            <span className="font-medium">{runStatusLabels[run.status]}</span>
            <span className="text-muted-foreground">
               {settled} of {run.orders.length} orders settled
               {Number(run.withdraw) > 0 &&
                  ` · ${asQuoteAmount(run.withdrawn, quoteAsset)} of ${asQuoteAmount(run.withdraw, quoteAsset)} withdrawn`}
            </span>
         </div>
         {run.error &&
            <Alert variant="destructive">
               <AlertDescription>{run.error}</AlertDescription>
            </Alert>}
         {run.orders.length > 0 && <RunOrdersTable run={run} quoteAsset={quoteAsset} />}
      </div>
   )
}
