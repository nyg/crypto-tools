import { InfoIcon } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

export default function FieldHint({ label = 'More information', children }) {
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
