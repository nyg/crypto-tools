import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TableHead } from '@/components/ui/table'
import SortIcon from './sort-icon'
import type { Sort } from '../../../types/kraken'

interface SortableHeadProps {
   column: string
   sort: Sort
   onSortChange: (sort: Sort) => void
   className?: string
   align?: 'right'
   children: ReactNode
}

export default function SortableHead({ column, sort, onSortChange, className, align, children }: SortableHeadProps) {
   const isActive = sort.column === column
   return (
      <TableHead className={cn(align === 'right' && 'text-right', className)}>
         <button
            type="button"
            className={cn('inline-flex w-full items-center gap-1 hover:text-foreground',
               align === 'right' && 'justify-end',
               isActive && 'font-semibold text-foreground')}
            onClick={() => onSortChange({
               column,
               direction: isActive && sort.direction === 'desc' ? 'asc' : 'desc'
            })}>
            {children}
            <SortIcon isActive={isActive} direction={sort.direction} />
         </button>
      </TableHead>
   )
}
