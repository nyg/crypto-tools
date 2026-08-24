import type * as React from 'react'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { Input as ShadcnInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Format a number string with thousand separators
const formatWithSeparators = (value: string | undefined): string => {
   if (!value) return ''

   // Split by decimal point
   const parts = value.split('.')
   const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\'')
   const decimalPart = parts[1]

   return decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart
}

// Remove thousand separators from a string
const stripSeparators = (value: string): string => {
   return value.replace(/'/g, '')
}

// Count separators before a given position
const countSeparatorsBefore = (str: string, position: number): number => {
   return (str.slice(0, position).match(/'/g) || []).length
}

interface NumericInputProps {
   name: string
   value?: string
   // A shim rather than a real change event: the raw value is handed back with the
   // thousand separators removed, which is not what the input element holds.
   onChange: (event: { target: { value: string } }) => void
   label: ReactNode
   className?: string
}

export default function NumericInput({ name, value, onChange, label, className = '' }: NumericInputProps) {

   const inputRef = useRef<HTMLInputElement>(null)

   const formattedValue = formatWithSeparators(value)

   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target
      const cursorPos = input.selectionStart ?? 0
      const oldFormatted = formattedValue
      const newRaw = stripSeparators(input.value)

      // Only allow valid numeric input (digits and one decimal point)
      if (newRaw !== '' && !/^\d*\.?\d*$/.test(newRaw)) {
         return
      }

      // Calculate new cursor position
      const separatorsBefore = countSeparatorsBefore(oldFormatted, cursorPos)
      const rawCursorPos = cursorPos - separatorsBefore

      // Trigger the onChange with the raw value
      onChange({ target: { value: newRaw } })

      // After state update, adjust cursor position
      requestAnimationFrame(() => {
         if (inputRef.current) {
            const newFormatted = formatWithSeparators(newRaw)

            // Find the correct cursor position in the new formatted string
            let newCursorPos = 0
            let rawCount = 0
            for (let i = 0; i < newFormatted.length && rawCount < rawCursorPos; i++) {
               if (newFormatted[i] !== '\'') {
                  rawCount++
               }
               newCursorPos = i + 1
            }

            inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
         }
      })
   }

   return (
      <div className={`space-y-1 ${className}`}>
         <Label htmlFor={name} className="pl-2.5 text-xs">{label}</Label>
         <ShadcnInput
            ref={inputRef}
            className="tabular-nums"
            type="text"
            inputMode="decimal"
            id={name}
            name={name}
            value={formattedValue}
            onChange={handleChange}
            autoComplete="off"
         />
      </div>
   )
}
