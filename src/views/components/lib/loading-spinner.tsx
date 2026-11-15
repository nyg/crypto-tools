import { Loader2Icon } from 'lucide-react'
import type { ReactNode } from 'react'


export default function LoadingSpinner({ children }: { children?: ReactNode }) {
   return (
      <div role="status" className="flex grow items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
         <Loader2Icon className="size-5 animate-spin" />
         {children ?? <span className="sr-only">Loading</span>}
      </div>
   )
}
