import { Loader2Icon } from 'lucide-react'
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { summarize } from './open-order-totals'
import { asCount } from '../lib/filter-options'
import { asAssetAmount } from '../../../utils/format'
import type { OpenOrder } from '../../../types/kraken'

export default function CancelOrdersDialog({
   orders, pairKey, baseAsset, quoteAsset, isCancelling, onConfirm, onOpenChange
}: {
   orders: OpenOrder[] | null
   pairKey: string
   baseAsset: string
   quoteAsset: string
   isCancelling?: boolean
   onConfirm: () => void
   onOpenChange: (open: boolean) => void
}) {

   const stats = summarize(orders ?? [])

   return (
      <AlertDialog open={orders != null} onOpenChange={open => !open && onOpenChange(false)}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>
                  Cancel {asCount(stats.count, 'order')}?
               </AlertDialogTitle>
               <AlertDialogDescription>
                  {stats.count === 1
                     ? `This removes the order from the ${pairKey} book on Kraken.`
                     : `This removes ${stats.count} ${pairKey} orders from the book on Kraken.`}{' '}
                  {asAssetAmount(Number(stats.volume))} {baseAsset} worth{' '}
                  {asAssetAmount(Number(stats.value))} {quoteAsset} stops being reserved.
                  Cancelling cannot be undone; {stats.count === 1 ? 'it' : 'they'} would have to be created again.
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
               <AlertDialogCancel disabled={isCancelling}>Keep them</AlertDialogCancel>
               <AlertDialogAction
                  variant="destructive"
                  disabled={isCancelling}
                  onClick={event => { event.preventDefault(); onConfirm() }}>
                  {isCancelling && <Loader2Icon className="size-4 animate-spin" />}
                  {stats.count === 1 ? 'Cancel the order' : `Cancel ${stats.count} orders`}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   )
}
