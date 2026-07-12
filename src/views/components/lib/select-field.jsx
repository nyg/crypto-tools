import { Label } from '@/components/ui/label'
import {
   Select,
   SelectTrigger,
   SelectValue,
   SelectContent,
   SelectItem,
} from '@/components/ui/select'

// shadcn-idiomatic labeled Select field (Radix based).
// Mirrors the space-y-1.5 field pattern used by NumericInput.
export default function SelectField({ name, label, value, onValueChange, options, placeholder, disabled, className = '' }) {
   return (
      <div className={`space-y-1.5 ${className}`}>
         <Label htmlFor={name}>{label}</Label>
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
