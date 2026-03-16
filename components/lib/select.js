export default function Select({ name, defaultValue, value, onChange, label, className = '', children }) {
   return (
      <fieldset className={`fieldset ${className}`}>
         <legend className="fieldset-legend pl-3">{label}</legend>
         <select
            className="select select-sm w-full"
            id={name}
            name={name}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange}>
            {children}
         </select>
      </fieldset>
   )
}
