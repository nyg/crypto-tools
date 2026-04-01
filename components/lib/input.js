import { Input as ShadcnInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Input({ name, type = 'text', defaultValue, value, onChange, label, className = '' }) {

   const autoComplete = type === 'password' ? 'current-password' : 'none'

   return (
      <div className={`space-y-1.5 ${className}`}>
         <Label htmlFor={name}>{label}</Label>
         <ShadcnInput
            type={type}
            id={name}
            name={name}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange}
            autoComplete={autoComplete}
         />
      </div>
   )
}
