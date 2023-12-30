import Link from 'next/link'
import { useRouter } from 'next/router'
import ExternalLink from './external-link'


export default function MenuLink({ children, href, isActive = (path, href) => path === href }) {

   const router = useRouter()

   const style = isActive(router.asPath,  href)
      ? 'text-gray-900 hover:text-gray-500 underline'
      : 'text-gray-400 hover:text-gray-900 hover:underline'

   return (
      <span className={`text-xs cursor-pointer ${style}`}>
         {href.startsWith('https://')
            ? <ExternalLink href={href}>{children}</ExternalLink>
            : <Link href={href}>{children}</Link>
         }
      </span>
   )
}
