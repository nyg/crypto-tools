import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export default function Section({ title, items, icon }) {
   return (
      <div className="mb-8">
         <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>{icon}</span>
            {title}
            <span className="font-normal text-muted-foreground">({items.length})</span>
         </h2>
         <div className="space-y-3">
            {items.map((item) => (
               <Card key={item.name}>
                  <CardContent className="p-4">
                     <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono font-bold text-lg">
                           {item.name}
                        </span>
                        <Badge variant="secondary">
                           {item.type}
                        </Badge>
                     </div>
                     <p className="text-muted-foreground leading-relaxed">
                        {item.description}
                     </p>
                  </CardContent>
               </Card>
            ))}
         </div>
      </div>
   )
}
