export default function Input({ name, type = 'text', defaultValue, value, onChange, label, className = '' }) {

   const autoComplete = type === 'password' ? 'current-password' : 'none'

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
