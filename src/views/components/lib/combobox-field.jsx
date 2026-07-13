import { useState } from 'react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'

// Searchable, scrollable select (shadcn Combobox = Popover + Command).
// Same field shape as SelectField, for lists with many options.
export default function ComboboxField({
   name,
   label,
   value,
   onValueChange,
   options,
   placeholder = 'Select…',
   searchPlaceholder = 'Search…',
   emptyText = 'No results.',
   disabled,
   className = '',
}) {
   const [open, setOpen] = useState(false)
   const selected = options.find(option => option.value === value)

   return (
      <div className={`space-y-1 ${className}`}>
         <Label htmlFor={name} className="pl-2.5 text-xs">{label}</Label>
         <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
               <Button
                  id={name}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  disabled={disabled}
                  className="w-full justify-between font-normal">
                  <span className={cn('truncate', !selected && 'text-muted-foreground')}>
                     {selected ? selected.label : placeholder}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
               </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
               <Command>
                  <CommandInput placeholder={searchPlaceholder} />
                  <CommandList>
                     <CommandEmpty>{emptyText}</CommandEmpty>
                     <CommandGroup>
                        {options.map(option =>
                           <CommandItem
                              key={option.value}
                              value={option.label}
                              onSelect={() => {
                                 onValueChange(option.value)
                                 setOpen(false)
                              }}>
                              <CheckIcon className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')} />
                              {option.label}
                           </CommandItem>
                        )}
                     </CommandGroup>
                  </CommandList>
               </Command>
            </PopoverContent>
         </Popover>
      </div>
   )
}
