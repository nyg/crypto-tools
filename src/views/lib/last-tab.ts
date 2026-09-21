import { messageOf } from './errors'
import { groupHref, groupOfPath, tabHrefs } from './tools'

const STORAGE_KEY = 'nav.lastTabs'

const readLastTabs = (): Record<string, unknown> => {
   try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed: unknown = saved === null ? {} : JSON.parse(saved)
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
         ? parsed as Record<string, unknown>
         : {}
   }
   catch (error) {
      console.warn(`Could not read ${STORAGE_KEY} from local storage:`, messageOf(error))
      return {}
   }
}

export function rememberTab(path: string) {
   const group = groupOfPath(path)
   if (!group) return

   try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readLastTabs(), [group.name]: path }))
   }
   catch (error) {
      console.warn(`Could not write ${STORAGE_KEY} to local storage:`, messageOf(error))
   }
}

export function sectionHref(name: string, currentPath: string): string {
   const hrefs = tabHrefs(name)
   if (hrefs.includes(currentPath)) return currentPath

   const last = readLastTabs()[name]
   return typeof last === 'string' && hrefs.includes(last) ? last : groupHref(name)
}
