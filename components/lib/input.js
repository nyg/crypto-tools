export default function Input({ name, type = 'text', defaultValue, value, checked, onChange, label, className = '' }) {

   const autoComplete = type === 'password' ? 'current-password' : 'none'

   return (
      <div className={`grid grid-cols-1 ${className}`}>
         <label htmlFor={name} className="px-3 pb-1 text-xs text-gray-800 col-span-full">
            {label}
         </label>
         {type === 'checkbox'
            ? <input
               className="mx-3 justify-self-start"
               type={type}
               id={name}
               name={name}
               checked={checked}
               defaultChecked={defaultValue}
               onChange={onChange}
            />
            : <input
               className="px-3 py-1 outline-hidden bg-gray-200 rounded-sm grow"
               type={type}
               id={name}
               name={name}
               value={value}
               defaultValue={defaultValue}
               onChange={onChange}
               autoComplete={autoComplete}
            />
         }
      </div>
   )
}
