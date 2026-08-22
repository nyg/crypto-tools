import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SortIcon({ isActive, direction, className = '' }) {

   if (!isActive) return <ArrowUpDownIcon className={cn('size-3 opacity-40', className)} />

   const Icon = direction === 'asc' ? ArrowUpIcon : ArrowDownIcon
   return <Icon className={cn('size-3', className)} />
}
