import { Link, useLocation } from 'react-router'
import PageHelpButton from './page-help-button'
import { cn } from '@/lib/utils'


export default function SubNav({ items, trailing }) {

   const { pathname } = useLocation()

   return (
      <div className="mb-6 flex items-end gap-4 border-b border-border">
         {/* -ml-3 cancels the first link's px-3 so its label lines up with the page
             heading and the header wordmark, which sit flush against the container. */}
         <nav className="-mb-px -ml-3 flex min-w-0 items-center gap-1 overflow-x-auto">
            {items.map(({ label, href }) => (
               <Link
                  key={href}
                  to={href}
                  aria-current={pathname === href ? 'page' : undefined}
                  className={cn(
                     'inline-flex h-9 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                     pathname === href && 'border-primary text-foreground'
                  )}>
                  {label}
               </Link>
            ))}
         </nav>

         {/* Opposite the tabs and sitting on the same rule: what the section is, and how
             fresh what it shows is, both belong beside the tabs rather than to any one
             page, and cost no row of their own. The freshness line is dropped where the
             tabs alone already fill the width, rather than pushing half of them out of
             sight for something the window was not narrowed to read; the help stays,
             because it is the one thing a cramped window makes more use of. */}
         <div className="-mr-1 ml-auto flex shrink-0 items-center gap-2">
            {trailing && <span className="hidden lg:block">{trailing}</span>}
            <PageHelpButton />
         </div>
      </div>
   )
}
