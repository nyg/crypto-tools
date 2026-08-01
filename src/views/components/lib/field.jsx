// A read-only stat tile: a muted caption above a value. Meant to be laid out in a
// grid by the caller, which owns the column count.
export default function Field({ label, children, title }) {
   return (
      <div className="space-y-0.5">
         <p className="text-xs text-muted-foreground">{label}</p>
         <p className="text-sm tabular-nums" title={title}>{children}</p>
      </div>
   )
}
