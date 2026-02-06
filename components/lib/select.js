export default function Select({ name, defaultValue, label, className = '', children }) {
   return (
      <div className={`grid grid-cols-1 ${className}`}>
         <label
            className="px-3 pb-1 text-xs text-gray-800 col-span-full"
            htmlFor={name}>{label}</label>
         <select
            className="px-2 py-1 outline-hidden bg-gray-200 rounded-sm grow border-r-8"
            id={name}
            name={name}
            defaultValue={defaultValue}>
            {children}
         </select>
      </div>
   )
}
