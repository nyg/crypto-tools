import { useEffect, useState } from 'react'

const isPlainObject = value =>
   value !== null && typeof value === 'object' && !Array.isArray(value)

// Merged over the default rather than replacing it, so a stored value written before a
// new field existed keeps working instead of leaving that field undefined. revive runs
// on the result either way, including when nothing was stored, so a caller can let
// something outside storage — a URL parameter, say — have the last word.
function read(key, defaultValue, revive) {
   const stored = readStored(key, defaultValue)
   return revive ? revive(stored, defaultValue) : stored
}

function readStored(key, defaultValue) {
   if (typeof window === 'undefined') return defaultValue

   try {
      const saved = localStorage.getItem(key)
      if (saved === null) return defaultValue

      const parsed = JSON.parse(saved)
      return isPlainObject(parsed) && isPlainObject(defaultValue)
         ? { ...defaultValue, ...parsed }
         : parsed
   }
   catch (error) {
      console.warn(`Could not read ${key} from local storage:`, error.message)
      return defaultValue
   }
}

export default function usePersistentState(key, defaultValue, revive) {

   const [value, setValue] = useState(() => read(key, defaultValue, revive))

   useEffect(() => {
      if (typeof window === 'undefined') return
      try {
         localStorage.setItem(key, JSON.stringify(value))
      }
      catch (error) {
         console.warn(`Could not write ${key} to local storage:`, error.message)
      }
   }, [key, value])

   return [value, setValue]
}
