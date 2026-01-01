export default function Section({ title, items, icon }) {
   return (
      <div className="mb-8">
         <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
            <span>{icon}</span>
            {title}
            <span className="font-normal text-gray-500">({items.length})</span>
         </h2>
         <div className="space-y-3">
            {items.map((item) => (
               <div key={item.name} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                     <span className="font-mono font-bold text-lg text-gray-900">
                        {item.name}
                     </span>
                     <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {item.type}
                     </span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                     {item.description}
                  </p>
               </div>
            ))}
         </div>
      </div>
   )
}
