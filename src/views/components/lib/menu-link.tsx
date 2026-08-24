import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import ExternalLink from './external-link'


interface MenuLinkProps {
   children: ReactNode
   href: string
   isActive?: (path: string, href: string) => boolean
}

export default function MenuLink({
   children, href, isActive = (path, href) => path === href
}: MenuLinkProps) {

   const location = useLocation()

   const style = isActive(location.pathname, href)
      ? 'text-foreground'
      : 'text-muted-foreground hover:text-foreground'

   const className = `text-sm font-medium transition-colors ${style}`

   return href.startsWith('https://')
      ? <ExternalLink href={href} className={className}>{children}</ExternalLink>
      : <Link to={href} className={className}>{children}</Link>
}
