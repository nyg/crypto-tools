import { Label } from '@/components/ui/label'

export default function Select({ name, defaultValue, value, onChange, label, className = '', children }) {
   return (
      <div className={`space-y-1.5 ${className}`}>
         <Label htmlFor={name}>{label}</Label>
         <select
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            id={name}
            name={name}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange}>
            {children}
         </select>
      </div>
   )
}
