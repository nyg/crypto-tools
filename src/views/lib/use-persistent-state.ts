import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { messageOf } from './errors'

// Layered over whatever storage holds, so a caller can let something outside storage
// — a URL parameter, say — have the last word.
type Revive<T> = (stored: T, defaultValue: T) => T

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
   value !== null && typeof value === 'object' && !Array.isArray(value)

// Merged over the default rather than replacing it, so a stored value written before a
// new field existed keeps working instead of leaving that field undefined. revive runs
// on the result either way, including when nothing was stored, so a caller can let
// something outside storage — a URL parameter, say — have the last word.
function read<T>(key: string, defaultValue: T, revive?: Revive<T>): T {
   const stored = readStored(key, defaultValue)
   return revive ? revive(stored, defaultValue) : stored
}

function readStored<T>(key: string, defaultValue: T): T {
   if (typeof window === 'undefined') return defaultValue

   try {
      const saved = localStorage.getItem(key)
      if (saved === null) return defaultValue

      const parsed: unknown = JSON.parse(saved)
      return isPlainObject(parsed) && isPlainObject(defaultValue)
         ? { ...defaultValue, ...parsed } as T
         : parsed as T
   }
   catch (error) {
      console.warn(`Could not read ${key} from local storage:`, messageOf(error))
      return defaultValue
   }
}

export default function usePersistentState<T>(
   key: string, defaultValue: T, revive?: Revive<T>
): [T, Dispatch<SetStateAction<T>>] {

   const [value, setValue] = useState<T>(() => read(key, defaultValue, revive))
   const settled = useRef(false)

   // Nothing is written on mount. The initial value is either what storage already
   // holds or a default nobody has chosen, and writing it back would persist whatever
   // revive layered on top — turning a one-off deep link into state the user has to
   // clear by hand. Only a later change is the user's, and only that is saved.
   useEffect(() => {
      if (!settled.current) {
         settled.current = true
         return
      }
      if (typeof window === 'undefined') return

      try {
         localStorage.setItem(key, JSON.stringify(value))
      }
      catch (error) {
         console.warn(`Could not write ${key} to local storage:`, messageOf(error))
      }
   }, [key, value])

   return [value, setValue]
}
