import { Link, useLocation } from 'react-router'
import { cn } from '@/lib/utils'


export default function SubNav({ items }) {

   const { pathname } = useLocation()

   return (
      <nav className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-border">
         {items.map(({ label, href }) => (
            <Link
               key={href}
               to={href}
               aria-current={pathname === href ? 'page' : undefined}
               className={cn(
                  '-mb-px inline-flex h-9 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                  pathname === href && 'border-primary text-foreground'
               )}>
               {label}
            </Link>
         ))}
      </nav>
   )
}
