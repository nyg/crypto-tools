import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import PageHelpButton from './page-help-button'
import { cn } from '@/lib/utils'


interface SubNavProps {
   items: { label: string, href: string }[]
   trailing?: ReactNode
}

export default function SubNav({ items, trailing }: SubNavProps) {

   const { pathname } = useLocation()
   const activeTab = useRef<HTMLAnchorElement>(null)

   useEffect(() => {
      activeTab.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
   }, [pathname])

   return (
      <div className="flex items-center gap-4">
         {/* -ml-2.5 cancels the first link's px-2.5 so its label lines up with the page
             heading and the header wordmark, which sit flush against the container. */}
         <nav className="-mb-px -ml-2.5 flex min-w-0 items-center gap-1 overflow-x-auto">
            {items.map(({ label, href }) => (
               <Link
                  key={href}
                  to={href}
                  ref={pathname === href ? activeTab : undefined}
                  aria-current={pathname === href ? 'page' : undefined}
                  className={cn(
                     'inline-flex h-8 items-center border-b-2 border-transparent px-2.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                     pathname === href && 'border-primary text-foreground'
                  )}>
                  {label}
               </Link>
            ))}
         </nav>

         {/* Opposite the tabs and on the same line: what the section is, and how
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
