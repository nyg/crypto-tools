import { Input as ShadcnInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Input({ name, type = 'text', defaultValue, value, onChange, label, hint, disabled = false, className = '' }) {

   const autoComplete = type === 'password' ? 'current-password' : 'none'

   return (
      <div className={`space-y-1 ${className}`}>
         <div className="flex items-center gap-1 pl-2.5">
            <Label htmlFor={name} className="text-xs">{label}</Label>
            {hint}
         </div>
         <ShadcnInput
            type={type}
            id={name}
            name={name}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange}
            disabled={disabled}
            autoComplete={autoComplete}
         />
      </div>
   )
}
