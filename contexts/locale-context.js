import { createContext, useContext } from 'react'

export const LocaleContext = createContext('en-GB')

export function useLocale() {
   return useContext(LocaleContext)
}
