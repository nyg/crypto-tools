import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '@/lib/utils'
import { asNumber } from '../../../utils/format'

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = {
   light: '',
   dark: '.dark'
} as const

type Theme = keyof typeof THEMES

export type ChartConfig = Record<string, {
   label?: React.ReactNode
   icon?: React.ComponentType
} & ({ color?: string, theme?: never } | { color?: never, theme: Record<Theme, string> })>

interface ChartContextProps {
   config: ChartConfig
}

// The payload entries Recharts hands to a custom tooltip or legend. Its own types
// describe them loosely, so the fields actually read here are named instead.
type ChartPayloadItem = {
   type?: string
   value?: unknown
   name?: string
   dataKey?: string | number
   color?: string
   payload?: Record<string, unknown>
}

const INITIAL_DIMENSION = {
   width: 320,
   height: 200
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
   const context = React.useContext(ChartContext)

   if (!context) {
      throw new Error('useChart must be used within a <ChartContainer />')
   }

   return context
}

function ChartContainer({
   id,
   className,
   children,
   config,
   initialDimension = INITIAL_DIMENSION,
   ...props
}: React.ComponentProps<'div'> & {
   config: ChartConfig
   initialDimension?: { width: number, height: number }
   children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
}) {
   const uniqueId = React.useId()
   const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`

   return (
      <ChartContext.Provider value={{ config }}>
         <div
            data-slot="chart"
            data-chart={chartId}
            className={cn(
               // The overrides that select on a hard-coded #ccc or #fff stroke are in
               // global.css instead: Tailwind escapes the quotes of an attribute
               // selector written here, and the CSS it emits does not parse.
               'flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-layer]:outline-hidden [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden',
               className
            )}
            {...props}>
            <ChartStyle id={chartId} config={config} />
            <RechartsPrimitive.ResponsiveContainer initialDimension={initialDimension}>
               {children}
            </RechartsPrimitive.ResponsiveContainer>
         </div>
      </ChartContext.Provider>
   )
}

const ChartStyle = ({
   id,
   config
}: { id: string, config: ChartConfig }) => {
   const colorConfig = Object.entries(config).filter(([, config]) => config.theme ?? config.color)

   if (!colorConfig.length) {
      return null
   }

   return (
      <style
         dangerouslySetInnerHTML={{
            __html: Object.entries(THEMES)
               .map(([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
         .map(([key, itemConfig]) => {
            const color =
  itemConfig.theme?.[theme as Theme] ??
  itemConfig.color
            return color ? `  --color-${key}: ${color};` : null
         })
         .join('\n')}
}
`)
               .join('\n'),
         }} />
   )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
   active,
   payload,
   className,
   indicator = 'dot',
   hideLabel = false,
   hideIndicator = false,
   label,
   labelFormatter,
   labelClassName,
   formatter,
   color,
   nameKey,
   labelKey
}: {
   active?: boolean
   payload?: ChartPayloadItem[]
   className?: string
   indicator?: 'line' | 'dot' | 'dashed'
   hideLabel?: boolean
   hideIndicator?: boolean
   label?: unknown
   labelFormatter?: (value: React.ReactNode, payload: ChartPayloadItem[]) => React.ReactNode
   labelClassName?: string
   formatter?: (
      value: unknown, name: string, item: ChartPayloadItem, index: number, payload: unknown
   ) => React.ReactNode
   color?: string
   nameKey?: string
   labelKey?: string
}) {
   const { config } = useChart()

   const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
         return null
      }

      const [item] = payload
      const key = `${labelKey ?? item?.dataKey ?? item?.name ?? 'value'}`
      const itemConfig = getPayloadConfigFromPayload(config, item, key)
      const value =
      !labelKey && typeof label === 'string'
         ? (config[label]?.label ?? label)
         : itemConfig?.label

      if (labelFormatter) {
         return (
            <div className={cn('font-medium', labelClassName)}>
               {labelFormatter(value, payload)}
            </div>
         )
      }

      if (!value) {
         return null
      }

      return <div className={cn('font-medium', labelClassName)}>{value}</div>
   }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
   ])

   if (!active || !payload?.length) {
      return null
   }

   const nestLabel = payload.length === 1 && indicator !== 'dot'

   return (
      <div
         className={cn(
            'grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl',
            className
         )}>
         {!nestLabel ? tooltipLabel : null}
         <div className="grid gap-1.5">
            {payload
               .filter((item) => item.type !== 'none')
               .map((item, index) => {
                  const key = `${nameKey ?? item.name ?? item.dataKey ?? 'value'}`
                  const itemConfig = getPayloadConfigFromPayload(config, item, key)
                  const indicatorColor = color ?? item.payload?.fill ?? item.color

                  return (
                     <div
                        key={index}
                        className={cn(
                           'flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground',
                           indicator === 'dot' && 'items-center'
                        )}>
                        {formatter && item?.value !== undefined && item.name ? (
                           formatter(item.value, item.name, item, index, item.payload)
                        ) : (
                           <>
                              {itemConfig?.icon ? (
                                 <itemConfig.icon />
                              ) : (
                                 !hideIndicator && (
                                    <div
                                       className={cn('shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)', {
                                          'h-2.5 w-2.5': indicator === 'dot',
                                          'w-1': indicator === 'line',
                                          'w-0 border-[1.5px] border-dashed bg-transparent':
                              indicator === 'dashed',
                                          'my-0.5': nestLabel && indicator === 'dashed',
                                       })}
                                       style={
                                          {
                                             '--color-bg': indicatorColor,
                                             '--color-border': indicatorColor
                                          } as React.CSSProperties
                                       } />
                                 )
                              )}
                              <div
                                 className={cn(
                                    'flex flex-1 justify-between leading-none',
                                    nestLabel ? 'items-end' : 'items-center'
                                 )}>
                                 <div className="grid gap-1.5">
                                    {nestLabel ? tooltipLabel : null}
                                    <span className="text-muted-foreground">
                                       {itemConfig?.label ?? item.name}
                                    </span>
                                 </div>
                                 {item.value != null && (
                                    <span className="font-mono font-medium text-foreground tabular-nums">
                                       {typeof item.value === 'number'
                                          ? asNumber(item.value)
                                          : String(item.value)}
                                    </span>
                                 )}
                              </div>
                           </>
                        )}
                     </div>
                  )
               })}
         </div>
      </div>
   )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
   className,
   hideIcon = false,
   payload,
   verticalAlign = 'bottom',
   nameKey
}: {
   className?: string
   hideIcon?: boolean
   payload?: ChartPayloadItem[]
   verticalAlign?: 'top' | 'bottom' | 'middle'
   nameKey?: string
}) {
   const { config } = useChart()

   if (!payload?.length) {
      return null
   }

   return (
      <div
         className={cn(
            'flex items-center justify-center gap-4',
            verticalAlign === 'top' ? 'pb-3' : 'pt-3',
            className
         )}>
         {payload
            .filter((item) => item.type !== 'none')
            .map((item, index) => {
               const key = `${nameKey ?? item.dataKey ?? 'value'}`
               const itemConfig = getPayloadConfigFromPayload(config, item, key)

               return (
                  <div
                     key={index}
                     className={cn(
                        'flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground'
                     )}>
                     {itemConfig?.icon && !hideIcon ? (
                        <itemConfig.icon />
                     ) : (
                        <div
                           className="h-2 w-2 shrink-0 rounded-[2px]"
                           style={{
                              backgroundColor: item.color,
                           }} />
                     )}
                     {itemConfig?.label}
                  </div>
               )
            })}
      </div>
   )
}

function getPayloadConfigFromPayload(
   config: ChartConfig,
   payload: unknown,
   key: string
) {
   if (typeof payload !== 'object' || payload === null) {
      return undefined
   }

   const entry = payload as Record<string, unknown>

   const payloadPayload =
    'payload' in entry &&
    typeof entry.payload === 'object' &&
    entry.payload !== null
       ? entry.payload as Record<string, unknown>
       : undefined

   let configLabelKey = key

   if (
      key in entry &&
    typeof entry[key] === 'string'
   ) {
      configLabelKey = entry[key]
   } else if (
      payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key] === 'string'
   ) {
      configLabelKey = payloadPayload[key]
   }

   return configLabelKey in config ? config[configLabelKey] : config[key]
}

export {
   ChartContainer,
   ChartTooltip,
   ChartTooltipContent,
   ChartLegend,
   ChartLegendContent,
   ChartStyle,
}
