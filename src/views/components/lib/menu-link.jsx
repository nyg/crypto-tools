import { Link, useLocation } from 'react-router'
import ExternalLink from './external-link'


export default function MenuLink({ children, href, isActive = (path, href) => path === href }) {

   const location = useLocation()

   const style = isActive(location.pathname, href)
      ? 'text-foreground underline'
      : 'text-muted-foreground hover:text-foreground hover:underline'

   return (
      <span className={`text-xs cursor-pointer ${style}`}>
         {href.startsWith('https://')
            ? <ExternalLink href={href}>{children}</ExternalLink>
            : <Link to={href}>{children}</Link>
         }
      </span>
   )
}
