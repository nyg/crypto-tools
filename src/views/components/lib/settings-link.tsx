import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { settingsOf } from '@/lib/tools'

interface SettingsLinkProps {
   group: string
   children?: ReactNode
}

export default function SettingsLink({ group, children = 'Settings' }: SettingsLinkProps) {
   return (
      <Link to={settingsOf(group).href} className="font-medium text-foreground underline underline-offset-4">
         {children}
      </Link>
   )
}
