import * as React from 'react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import type {
   ChevronProps, CustomComponents, DayButton, DropdownProps, RootProps, WeekNumberProps
} from 'react-day-picker'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from 'lucide-react'

function CalendarRoot({ className, rootRef, ...props }: RootProps) {
   return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />
}

function CalendarChevron({ className, orientation, ...props }: ChevronProps) {
   const Icon = orientation === 'left' ? ChevronLeftIcon
      : orientation === 'right' ? ChevronRightIcon
         : ChevronDownIcon

   return <Icon className={cn('size-4', className)} {...props} />
}

function CalendarWeekNumber({ children, ...props }: WeekNumberProps) {
   return (
      <td {...props}>
         <div className="flex size-(--cell-size) items-center justify-center text-center">
            {children}
         </div>
      </td>
   )
}

// react-day-picker's own month and year dropdowns are native <select> elements laid
// invisibly over the caption, and a WebView hands the AppKit popup a font it cannot
// resolve, so on macOS the menu comes up in a serif. Three things here are load-bearing:
// the trigger stays positioned so it paints above the absolutely placed nav and can be
// clicked, the popup renders inline so the surrounding Popover still counts it as
// inside, and popper placement keeps Radix on floating-ui's fixed strategy rather than
// the item-aligned maths, which needs a Select.Value the caption does not render.
function CalendarDropdown({ options, value, onChange, disabled, className, 'aria-label': ariaLabel }: DropdownProps) {

   const selected = options?.find(option => option.value === Number(value))

   return (
      <Select
         value={String(value)}
         disabled={disabled}
         onValueChange={next =>
            onChange?.({ target: { value: next } } as React.ChangeEvent<HTMLSelectElement>)}>
         <SelectTrigger
            size="sm"
            aria-label={ariaLabel}
            className={cn('relative h-(--cell-size) gap-1 border-transparent px-1.5 text-sm font-medium hover:border-input', className)}>
            {selected?.label}
         </SelectTrigger>
         <SelectContent portal={false} position="popper" align="start" className="min-w-0">
            {options?.map(option =>
               <SelectItem key={option.value} value={String(option.value)} disabled={option.disabled}>
                  {option.label}
               </SelectItem>)}
         </SelectContent>
      </Select>
   )
}

function Calendar({
   className,
   classNames,
   showOutsideDays = true,
   captionLayout = 'label',
   buttonVariant = 'ghost',
   locale,
   formatters,
   components,
   ...props
}: React.ComponentProps<typeof DayPicker> & {
   buttonVariant?: VariantProps<typeof buttonVariants>['variant']
}) {
   const defaultClassNames = getDefaultClassNames()

   // A fresh Dropdown identity on every render would remount the Select and close the
   // month list mid-click; the native <select> it replaces held no state to lose.
   const mergedComponents = React.useMemo((): Partial<CustomComponents> => ({
      Root: CalendarRoot,
      Chevron: CalendarChevron,
      Dropdown: CalendarDropdown,
      WeekNumber: CalendarWeekNumber,
      DayButton: props => <CalendarDayButton locale={locale} {...props} />,
      ...components
   }), [locale, components])

   return (
      <DayPicker
         showOutsideDays={showOutsideDays}
         className={cn(
            'group/calendar bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent',
            String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
            String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
            className
         )}
         captionLayout={captionLayout}
         locale={locale}
         formatters={{
            formatMonthDropdown: (date) =>
               date.toLocaleString(locale?.code, { month: 'short' }),
            ...formatters,
         }}
         classNames={{
            root: cn('w-fit', defaultClassNames.root),
            months: cn('relative flex flex-col gap-4 md:flex-row', defaultClassNames.months),
            month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
            nav: cn(
               'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
               defaultClassNames.nav
            ),
            button_previous: cn(
               buttonVariants({ variant: buttonVariant }),
               'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
               defaultClassNames.button_previous
            ),
            button_next: cn(
               buttonVariants({ variant: buttonVariant }),
               'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
               defaultClassNames.button_next
            ),
            month_caption: cn(
               'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
               defaultClassNames.month_caption
            ),
            dropdowns: cn(
               'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium',
               defaultClassNames.dropdowns
            ),
            caption_label: cn('font-medium select-none', captionLayout === 'label'
               ? 'text-sm'
               : 'flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground', defaultClassNames.caption_label),
            month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
            weekdays: cn('flex', defaultClassNames.weekdays),
            weekday: cn(
               'flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none',
               defaultClassNames.weekday
            ),
            week: cn('mt-2 flex w-full', defaultClassNames.week),
            week_number_header: cn('w-(--cell-size) select-none', defaultClassNames.week_number_header),
            week_number: cn(
               'text-[0.8rem] text-muted-foreground select-none',
               defaultClassNames.week_number
            ),
            day: cn(
               'group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)',
               props.showWeekNumber
                  ? '[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)'
                  : '[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)',
               defaultClassNames.day
            ),
            range_start: cn(
               'relative isolate z-0 rounded-l-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted',
               defaultClassNames.range_start
            ),
            range_middle: cn('rounded-none', defaultClassNames.range_middle),
            range_end: cn(
               'relative isolate z-0 rounded-r-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted',
               defaultClassNames.range_end
            ),
            today: cn(
               'rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none',
               defaultClassNames.today
            ),
            outside: cn(
               'text-muted-foreground aria-selected:text-muted-foreground',
               defaultClassNames.outside
            ),
            disabled: cn('text-muted-foreground opacity-50', defaultClassNames.disabled),
            hidden: cn('invisible', defaultClassNames.hidden),
            ...classNames,
         }}
         components={mergedComponents}
         {...props} />
   )
}

function CalendarDayButton({
   className,
   day,
   modifiers,
   locale,
   ...props
}: React.ComponentProps<typeof DayButton> & { locale?: React.ComponentProps<typeof DayPicker>['locale'] }) {
   const defaultClassNames = getDefaultClassNames()

   const ref = React.useRef<HTMLButtonElement>(null)
   React.useEffect(() => {
      if (modifiers.focused) ref.current?.focus()
   }, [modifiers.focused])

   return (
      <Button
         ref={ref}
         variant="ghost"
         size="icon"
         data-day={day.date.toLocaleDateString(locale?.code)}
         data-selected-single={
            modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
         }
         data-range-start={modifiers.range_start}
         data-range-end={modifiers.range_end}
         data-range-middle={modifiers.range_middle}
         className={cn(
            'relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70',
            defaultClassNames.day,
            className
         )}
         {...props} />
   )
}

export { Calendar, CalendarDayButton }
