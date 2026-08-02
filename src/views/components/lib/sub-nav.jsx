import { Link, useLocation } from 'react-router'
import { cn } from '@/lib/utils'


export default function SubNav({ items }) {

   const { pathname } = useLocation()

   return (
      <div className="mb-6 border-b border-border">
         {/* -ml-3 cancels the first link's px-3 so its label lines up with the page
             heading and the header wordmark, which sit flush against the container. */}
         <nav className="-mb-px -ml-3 flex items-center gap-1 overflow-x-auto">
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
      </div>
   )
}
