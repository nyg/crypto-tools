export default function MenuItem({ children }) {
   return (
      <span className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 hover:underline">
         {children}
      </span>
   )
}
