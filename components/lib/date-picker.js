import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

function formatDisplayDate(date, hours, minutes, seconds) {
   const dateStr = date.toISOString().split('T')[0]
   const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
   // Use ISO-8601 UTC format so parsing with new Date(...) is reliable across browsers
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
   const dropdownRef = useRef(null)

   // Close dropdown when clicking outside
   useEffect(() => {
      const handleClickOutside = (event) => {
         if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setIsOpen(false)
         }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
   }, [])

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
      <fieldset className={`fieldset ${className}`}>
         <legend className="fieldset-legend pl-3">{label}</legend>
         <input type="hidden" name={name} value={formatFormValue(selectedDate)} />
         <div className="relative" ref={dropdownRef}>
            <input
               type="text"
               className="input input-sm w-full"
               value={inputValue}
               onChange={handleInputChange}
               onBlur={handleInputBlur}
               onFocus={() => setIsOpen(true)}
            />
            {isOpen && (
               <div className="absolute z-50 mt-1 bg-base-100 shadow-lg rounded-box p-2">
                  <DayPicker
                     mode="single"
                     selected={selectedDate}
                     onSelect={handleSelect}
                     defaultMonth={selectedDate}
                  />
                  <div className="flex items-center gap-2 pt-2 border-t border-base-300">
                     <span className="text-sm">Time (UTC):</span>
                     <input
                        type="number"
                        min="0"
                        max="23"
                        value={hours}
                        onChange={(e) => handleTimeChange(e.target.value, minutes, seconds)}
                        className="input input-sm w-16 text-center"
                        placeholder="HH"
                     />
                     <span>:</span>
                     <input
                        type="number"
                        min="0"
                        max="59"
                        value={minutes}
                        onChange={(e) => handleTimeChange(hours, e.target.value, seconds)}
                        className="input input-sm w-16 text-center"
                        placeholder="MM"
                     />
                     <span>:</span>
                     <input
                        type="number"
                        min="0"
                        max="59"
                        value={seconds}
                        onChange={(e) => handleTimeChange(hours, minutes, e.target.value)}
                        className="input input-sm w-16 text-center"
                        placeholder="SS"
                     />
                  </div>
               </div>
            )}
         </div>
      </fieldset>
   )
}
