import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SortIconProps {
   isActive: boolean
   direction?: 'asc' | 'desc'
   className?: string
}

export default function SortIcon({ isActive, direction, className = '' }: SortIconProps) {

   if (!isActive) return <ChevronsUpDownIcon className={cn('size-3 opacity-40', className)} />

   const Icon = direction === 'asc' ? ChevronUpIcon : ChevronDownIcon
   return <Icon className={cn('size-3', className)} />
}
