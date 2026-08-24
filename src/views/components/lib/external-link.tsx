import type { ReactNode } from 'react'

interface ExternalLinkProps {
   href: string
   className?: string
   children: ReactNode
}

export default function ExternalLink({ href, className, children }: ExternalLinkProps) {
   return (
      <a href={href} target="_blank" rel="noreferrer" className={`hover:underline ${className}`}>
         {children}
      </a>
   )
}
