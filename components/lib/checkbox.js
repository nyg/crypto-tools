export default function Checkbox({ name, defaultChecked, checked, onChange, label, className = '' }) {
   return (
      <label className={`label gap-2 cursor-pointer justify-start ${className}`}>
         <input
            className="checkbox checkbox-sm"
            type="checkbox"
            id={name}
            name={name}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={onChange}
         />
         <span>{label}</span>
      </label>
   )
}
