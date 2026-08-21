import { useLocation } from 'react-router'
import { HelpCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger, PopoverDescription } from '@/components/ui/popover'
import pageHelp from '@/lib/page-help'

// What a page is and where its data comes from, one click away in the same corner on
// every route, rather than a banner each page pays for in height whether or not it is
// still being read.
export default function PageHelpButton() {

   const { pathname } = useLocation()
   const help = pageHelp[pathname]

   if (!help) return null

   return (
      <Popover>
         <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
               <HelpCircleIcon className="size-4" />
               <span className="sr-only">About this page</span>
            </Button>
         </PopoverTrigger>
         <PopoverContent align="end" className="w-88">
            <PopoverDescription>{help}</PopoverDescription>
         </PopoverContent>
      </Popover>
   )
}
