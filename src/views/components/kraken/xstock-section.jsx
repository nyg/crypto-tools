import { Badge } from '@/components/ui/badge'

export default function Section({ title, items }) {
   return (
      <section className="space-y-3">
         <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {title} ({items.length})
         </h3>
         <div className="space-y-3">
            {items.map(item =>
               <div key={item.name} className="space-y-1.5 rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                     <span className="font-mono text-sm font-medium">{item.name}</span>
                     <Badge variant="secondary">{item.type}</Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                     {item.description}
                  </p>
               </div>
            )}
         </div>
      </section>
   )
}
