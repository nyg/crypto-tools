import { useState, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { Label } from '@/components/ui/label'
import { Input as ShadcnInput } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function formatDisplayDate(date, hours, minutes, seconds) {
   const dateStr = date.toISOString().split('T')[0]
   const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
   return `${dateStr}T${timeStr}Z`
}

export default function DatePicker({ name, label, defaultValue, className = '' }) {

   const initialDate = defaultValue ? new Date(defaultValue) : new Date()
   const [selectedDate, setSelectedDate] = useState(initialDate)
   const [hours, setHours] = useState(initialDate.getUTCHours().toString().padStart(2, '0'))
   const [minutes, setMinutes] = useState(initialDate.getUTCMinutes().toString().padStart(2, '0'))
   const [seconds, setSeconds] = useState(initialDate.getUTCSeconds().toString().padStart(2, '0'))
   const [isOpen, setIsOpen] = useState(false)
   const [inputValue, setInputValue] = useState(
      formatDisplayDate(initialDate, initialDate.getUTCHours(), initialDate.getUTCMinutes(), initialDate.getUTCSeconds())
   )

   const handleSelect = (date) => {
      if (date) {
         const newDate = new Date(Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            parseInt(hours) || 0,
            parseInt(minutes) || 0,
            parseInt(seconds) || 0
         ))
         setSelectedDate(newDate)
      }
   }

   const handleTimeChange = (newHours, newMinutes, newSeconds) => {
      const h = parseInt(newHours) || 0
      const m = parseInt(newMinutes) || 0
      const s = parseInt(newSeconds) || 0
      const newDate = new Date(Date.UTC(
         selectedDate.getUTCFullYear(),
         selectedDate.getUTCMonth(),
         selectedDate.getUTCDate(),
         h,
         m,
         s
      ))
      setSelectedDate(newDate)
      setHours(newHours)
      setMinutes(newMinutes)
      setSeconds(newSeconds)
   }

   // Keep inputValue in sync when date/time changes via picker
   useEffect(() => {
      setInputValue(formatDisplayDate(selectedDate, hours, minutes, seconds))
   }, [selectedDate, hours, minutes, seconds])

   const handleInputChange = (e) => {
      setInputValue(e.target.value)
   }

   const handleInputBlur = () => {
      const parsed = new Date(inputValue)
      if (!isNaN(parsed)) {
         const utc = new Date(Date.UTC(
            parsed.getFullYear(), parsed.getMonth(), parsed.getDate(),
            parsed.getHours(), parsed.getMinutes(), parsed.getSeconds()
         ))
         setSelectedDate(utc)
         setHours(utc.getUTCHours().toString().padStart(2, '0'))
         setMinutes(utc.getUTCMinutes().toString().padStart(2, '0'))
         setSeconds(utc.getUTCSeconds().toString().padStart(2, '0'))
      } else {
         setInputValue(formatDisplayDate(selectedDate, hours, minutes, seconds))
      }
   }

   const formatFormValue = (date) => {
      return date.toISOString()
   }

   return (
      <div className={`space-y-1.5 ${className}`}>
         <Label>{label}</Label>
         <input type="hidden" name={name} value={formatFormValue(selectedDate)} />
         <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
               <ShadcnInput
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  onClick={() => setIsOpen(true)}
               />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
               <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleSelect}
                  defaultMonth={selectedDate}
               />
               <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <span className="text-sm text-muted-foreground">UTC:</span>
                  <ShadcnInput
                     type="number"
                     min="0"
                     max="23"
                     value={hours}
                     onChange={(e) => handleTimeChange(e.target.value, minutes, seconds)}
                     className="w-16 text-center"
                     placeholder="HH"
                  />
                  <span className="text-muted-foreground">:</span>
                  <ShadcnInput
                     type="number"
                     min="0"
                     max="59"
                     value={minutes}
                     onChange={(e) => handleTimeChange(hours, e.target.value, seconds)}
                     className="w-16 text-center"
                     placeholder="MM"
                  />
                  <span className="text-muted-foreground">:</span>
                  <ShadcnInput
                     type="number"
                     min="0"
                     max="59"
                     value={seconds}
                     onChange={(e) => handleTimeChange(hours, minutes, e.target.value)}
                     className="w-16 text-center"
                     placeholder="SS"
                  />
               </div>
            </PopoverContent>
         </Popover>
      </div>
   )
}
