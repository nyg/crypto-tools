import { Loader2Icon } from 'lucide-react'
import {
   AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
   AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { asQuantity } from './format'
import type { PortfolioSummary } from '../../../types/api'

interface ArchiveDialogProps {
   portfolio: PortfolioSummary | null
   isArchiving: boolean
   onConfirm: () => void
   onOpenChange: (open: boolean) => void
}

export default function ArchiveDialog({ portfolio, isArchiving, onConfirm, onOpenChange }: ArchiveDialogProps) {

   const held = portfolio?.holdings.filter(({ quantity }) => Number(quantity) !== 0) ?? []

   return (
      <AlertDialog open={portfolio !== null} onOpenChange={open => !open && onOpenChange(false)}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>Archive {portfolio?.name}?</AlertDialogTitle>
               <AlertDialogDescription>
                  Nothing is sold.{' '}
                  {held.length > 0
                     ? `What it holds — ${held.map(({ asset, quantity }) => `${asQuantity(quantity)} ${asset}`).join(', ')} — becomes unallocated in your account.`
                     : 'It holds nothing, so nothing changes in your account.'}{' '}
                  Its history is kept, but the portfolio disappears from this page for good.
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
               <AlertDialogCancel disabled={isArchiving}>Keep it</AlertDialogCancel>
               <AlertDialogAction
                  variant="destructive"
                  disabled={isArchiving}
                  onClick={event => { event.preventDefault(); onConfirm() }}>
                  {isArchiving && <Loader2Icon className="size-4 animate-spin" />}
                  Archive
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   )
}
