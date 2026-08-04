import { InfoIcon } from 'lucide-react'

export default function InfoBanner({ children }) {
   return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-300/60 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/25 dark:bg-blue-950/30 dark:text-blue-100">
         <InfoIcon className="size-5 shrink-0" />
         <p>{children}</p>
      </div>
   )
}
