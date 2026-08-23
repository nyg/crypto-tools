import type { ReactNode } from 'react'
import { Checkbox as ShadcnCheckbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

// The wrapped Radix checkbox reports through onCheckedChange; this shim keeps the
// call sites written against a form event, the way every other field here is.
interface CheckboxProps {
   name: string
   defaultChecked?: boolean
   checked?: boolean
   onChange?: (event: { target: { checked: boolean } }) => void
   label: ReactNode
   className?: string
}

export default function Checkbox({
   name, defaultChecked, checked, onChange, label, className = ''
}: CheckboxProps) {
   return (
      <div className={`flex items-center gap-2 ${className}`}>
         <ShadcnCheckbox
            id={name}
            name={name}
            checked={checked}
            defaultChecked={defaultChecked}
            onCheckedChange={(val) => onChange?.({ target: { checked: val === true } })}
         />
         <Label htmlFor={name} className="cursor-pointer text-xs font-normal">{label}</Label>
      </div>
   )
}
