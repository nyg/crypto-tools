import { useState } from 'react'
import { CalendarIcon, CircleXIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input as ShadcnInput } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { locales } from '../../../utils/locale'

const displayFormatter = new Intl.DateTimeFormat(locales, {
   year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC'
})

const captionFormatter = new Intl.DateTimeFormat(locales, { year: 'numeric', month: 'long' })
const monthFormatter = new Intl.DateTimeFormat(locales, { month: 'short' })
const yearFormatter = new Intl.DateTimeFormat(locales, { year: 'numeric' })
const weekdayFormatter = new Intl.DateTimeFormat(locales, { weekday: 'short' })
const dayFormatter = new Intl.DateTimeFormat(locales, { day: 'numeric' })

const patternParts = displayFormatter.formatToParts(Date.UTC(2024, 11, 31))

const fieldOrder = patternParts.filter(part => part.type !== 'literal').map(part => part.type)

const hints = { year: 'yyyy', month: 'mm', day: 'dd' }

const placeholder = patternParts
   .map(part => part.type === 'literal' ? part.value : hints[part.type])
   .join('')

const weekStartsOn = (() => {
   try {
      const locale = new Intl.Locale(displayFormatter.resolvedOptions().locale)
      const info = locale.getWeekInfo?.() ?? locale.weekInfo
      return (info?.firstDay ?? 1) % 7
   }
   catch {
      return 1
   }
})()

const START_MONTH = new Date(2011, 0)
const END_MONTH = new Date()

const asDisplay = (value) => value
   ? displayFormatter.format(new Date(`${value}T00:00:00Z`))
   : ''

const asLocalDate = (value) => {
   if (!value) return undefined
   const [year, month, day] = value.split('-').map(Number)
   return new Date(year, month - 1, day)
}

const asValue = (date) => date
   ? [
      String(date.getFullYear()).padStart(4, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
   ].join('-')
   : ''

const parseDisplay = (text) => {
   const groups = text.match(/\d+/g)
   if (!groups || groups.length !== fieldOrder.length) return null

   const fields = Object.fromEntries(fieldOrder.map((type, index) => [type, Number(groups[index])]))
   const year = fields.year < 100 ? 2000 + fields.year : fields.year
   const date = new Date(Date.UTC(year, fields.month - 1, fields.day))

   const isRoundTrip = date.getUTCFullYear() === year
      && date.getUTCMonth() === fields.month - 1
      && date.getUTCDate() === fields.day

   return isRoundTrip ? date.toISOString().slice(0, 10) : null
}

export default function DateField({ name, label, value, onValueChange, disabled = false, className = '' }) {

   const [open, setOpen] = useState(false)
   const [text, setText] = useState(asDisplay(value))
   const [shown, setShown] = useState(value)

   if (value !== shown) {
      setShown(value)
      setText(asDisplay(value))
   }

   const commit = () => {
      const trimmed = text.trim()

      if (trimmed === '') {
         if (value) onValueChange('')
         return
      }

      const parsed = parseDisplay(trimmed)
      if (parsed === null) setText(asDisplay(value))
      else if (parsed !== value) onValueChange(parsed)
      else setText(asDisplay(value))
   }

   const onKeyDown = (event) => {
      if (event.key === 'Enter') {
         event.preventDefault()
         commit()
      }
      else if (event.key === 'Escape') {
         setText(asDisplay(value))
      }
   }

   const selected = asLocalDate(value)

   return (
      <div className={`space-y-1 ${className}`}>
         <Label htmlFor={name} className="pl-2.5 text-xs">{label}</Label>
         <div className="relative">
            <ShadcnInput
               id={name}
               name={name}
               value={text}
               placeholder={placeholder}
               inputMode="numeric"
               autoComplete="off"
               disabled={disabled}
               onChange={(event) => setText(event.target.value)}
               onBlur={commit}
               onKeyDown={onKeyDown}
               className={text ? 'pr-14' : 'pr-8'} />
            {text &&
               <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled}
                  aria-label={`Clear the ${label.toLowerCase()} date`}
                  className="absolute inset-y-0 right-7 my-auto text-muted-foreground hover:bg-transparent hover:text-foreground"
                  onClick={() => {
                     setText('')
                     if (value) onValueChange('')
                  }}>
                  <CircleXIcon className="size-4" />
               </Button>}
            <Popover open={open} onOpenChange={setOpen}>
               <PopoverTrigger asChild>
                  <Button
                     type="button"
                     variant="ghost"
                     size="icon-xs"
                     disabled={disabled}
                     aria-label={`Pick a ${label.toLowerCase()} date`}
                     className="absolute inset-y-0 right-1 my-auto text-muted-foreground hover:bg-transparent hover:text-foreground">
                     <CalendarIcon className="size-4" />
                  </Button>
               </PopoverTrigger>
               <PopoverContent align="end" className="w-auto p-0">
                  <Calendar
                     mode="single"
                     selected={selected}
                     defaultMonth={selected}
                     captionLayout="dropdown"
                     startMonth={START_MONTH}
                     endMonth={END_MONTH}
                     weekStartsOn={weekStartsOn}
                     formatters={{
                        formatCaption: (date) => captionFormatter.format(date),
                        formatMonthDropdown: (date) => monthFormatter.format(date),
                        formatYearDropdown: (date) => yearFormatter.format(date),
                        formatWeekdayName: (date) => weekdayFormatter.format(date),
                        formatDay: (date) => dayFormatter.format(date)
                     }}
                     onSelect={(date) => {
                        onValueChange(asValue(date))
                        setOpen(false)
                     }} />
               </PopoverContent>
            </Popover>
         </div>
      </div>
   )
}
