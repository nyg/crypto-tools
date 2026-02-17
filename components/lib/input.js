export default function Input({ name, type = 'text', defaultValue, value, checked, onChange, label, className = '' }) {

   const autoComplete = type === 'password' ? 'current-password' : 'none'

   if (type === 'checkbox') {
      return (
         <label className={`label gap-2 cursor-pointer justify-start ${className}`}>
            <input
               className="checkbox checkbox-sm"
               type="checkbox"
               id={name}
               name={name}
               checked={checked}
               defaultChecked={defaultValue}
               onChange={onChange}
            />
            <span>{label}</span>
         </label>
      )
   }

   return (
      <fieldset className={`fieldset ${className}`}>
         <legend className="fieldset-legend pl-3">{label}</legend>
         <input
            className="input input-sm w-full"
            type={type}
            id={name}
            name={name}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange}
            autoComplete={autoComplete}
         />
      </fieldset>
   )
}
