import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import {
   Select,
   SelectTrigger,
   SelectValue,
   SelectContent,
   SelectItem,
} from '@/components/ui/select'

// shadcn-idiomatic labeled Select field (Radix based).
// Mirrors the space-y-1 field pattern used by NumericInput.
export interface FieldOption {
   value: string
   label: string
}

interface SelectFieldProps {
   name: string
   // Absent where the field sits in a card header that already names it.
   label?: ReactNode
   value?: string
   onValueChange: (value: string) => void
   options: FieldOption[]
   placeholder?: string
   disabled?: boolean
   className?: string
}

export default function SelectField({
   name, label, value, onValueChange, options, placeholder, disabled, className = ''
}: SelectFieldProps) {
   return (
      <div className={`space-y-1 ${className}`}>
         <Label htmlFor={name} className="pl-2.5 text-xs">{label}</Label>
         <Select value={value} onValueChange={onValueChange} disabled={disabled}>
            <SelectTrigger id={name} className="w-full">
               <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
               {options.map(option =>
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
               )}
            </SelectContent>
         </Select>
      </div>
   )
}
