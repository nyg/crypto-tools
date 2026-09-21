import type { ReactNode } from 'react'

interface ExternalLinkProps {
   href: string
   className?: string
   title?: string
   children: ReactNode
}

export default function ExternalLink({ href, className, title, children }: ExternalLinkProps) {
   return (
      <a href={href} target="_blank" rel="noreferrer" title={title} className={`hover:underline ${className}`}>
         {children}
      </a>
   )
}
