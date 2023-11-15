export default function ExternalLink({ href, className, children }) {
   return (
      <a href={href} target="_blank" rel="noreferrer" className={`hover:underline ${className}`}>
         {children}
      </a>
   )
}
