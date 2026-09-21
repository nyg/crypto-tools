import { useSyncExternalStore } from 'react'
import { messageOf } from './errors'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'ui.theme'
const darkScheme = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'

const systemTheme = (): Theme => darkScheme.matches ? 'dark' : 'light'

function readChoice(): Theme | null {
   try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return isTheme(saved) ? saved : null
   }
   catch (error) {
      console.warn(`Could not read ${STORAGE_KEY} from local storage:`, messageOf(error))
      return null
   }
}

function writeChoice(theme: Theme | null) {
   try {
      if (theme) localStorage.setItem(STORAGE_KEY, theme)
      else localStorage.removeItem(STORAGE_KEY)
   }
   catch (error) {
      console.warn(`Could not write ${STORAGE_KEY} to local storage:`, messageOf(error))
   }
}

let choice = readChoice()

const currentTheme = (): Theme => choice ?? systemTheme()

function withoutTransitions(change: () => void) {
   const freeze = document.createElement('style')
   freeze.textContent = '*, *::before, *::after { transition: none !important }'
   document.head.appendChild(freeze)
   change()
   void window.getComputedStyle(document.body).opacity
   requestAnimationFrame(() => freeze.remove())
}

function applyTheme() {
   withoutTransitions(() => document.documentElement.classList.toggle('dark', currentTheme() === 'dark'))
   listeners.forEach(listener => listener())
}

export function toggleTheme() {
   const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
   choice = next === systemTheme() ? null : next
   writeChoice(choice)
   applyTheme()
}

darkScheme.addEventListener('change', applyTheme)

window.addEventListener('storage', event => {
   if (event.key !== null && event.key !== STORAGE_KEY) return
   choice = readChoice()
   applyTheme()
})

const subscribe = (listener: () => void) => {
   listeners.add(listener)
   return () => {
      listeners.delete(listener)
   }
}

export const useTheme = (): Theme => useSyncExternalStore(subscribe, currentTheme)
