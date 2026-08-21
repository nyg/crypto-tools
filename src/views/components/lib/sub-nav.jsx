import { Link, useLocation } from 'react-router'
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

         {/* Opposite the tabs and on the same baseline: it belongs to the whole section
             rather than to the page being looked at, and costs no row of its own. Hidden
             where the tabs alone already fill the width, rather than pushing half of them
             out of sight for a line that is not what the window was narrowed to read. */}
         {trailing && <div className="ml-auto hidden shrink-0 pb-2 lg:block">{trailing}</div>}
      </div>
   )
}
