import type { Sort } from '../../types/kraken'

export type SortKey = string | number | null

export type SortKeys<T> = Record<string, (row: T) => SortKey>

export const numericKey = (value: string | null | undefined): number | null =>
   value === null || value === undefined ? null : Number(value)

export function sortRows<T>(rows: T[], sort: Sort, keys: SortKeys<T>): T[] {

   const keyOf = sort.column ? keys[sort.column] : undefined
   if (!keyOf) return rows

   const sign = sort.direction === 'asc' ? 1 : -1

   return rows.toSorted((a, b) => {
      const left = keyOf(a)
      const right = keyOf(b)
      if (left === right) return 0
      if (left === null) return 1
      if (right === null) return -1
      const order = typeof left === 'string' ? left.localeCompare(String(right)) : left - Number(right)
      return sign * order
   })
}
