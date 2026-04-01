import { Checkbox as ShadcnCheckbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export default function Checkbox({ name, defaultChecked, checked, onChange, label, className = '' }) {
   return (
      <div className={`flex items-center gap-2 ${className}`}>
         <ShadcnCheckbox
            id={name}
            name={name}
            checked={checked}
            defaultChecked={defaultChecked}
            onCheckedChange={(val) => onChange?.({ target: { checked: val } })}
         />
         <Label htmlFor={name} className="cursor-pointer font-normal">{label}</Label>
      </div>
   )
}
