import { InfoIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Popover, PopoverContent,PopoverTrigger } from '@/components/ui/popover'

interface FieldHintProps {
   label?: string
   children: ReactNode
}

export default function FieldHint({ label = 'More information', children }: FieldHintProps) {
   return (
      <Popover>
         <PopoverTrigger
            type="button"
            aria-label={label}
            className="text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-hidden">
            <InfoIcon className="size-3.5" />
         </PopoverTrigger>
         <PopoverContent align="start" className="text-xs leading-relaxed text-muted-foreground">
            <p>{children}</p>
         </PopoverContent>
      </Popover>
   )
}
