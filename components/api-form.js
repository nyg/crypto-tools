import { useEffect } from 'react'
import Input from './lib/input'
import eventBus from '../utils/event-bus'


export default function ApiForm() {

   useEffect(() =>
      eventBus.on('menu.item.settings.clicked', () => {
         const settings = document.getElementById('settings')
         settings.style.display = settings.style.display == 'none' ? 'grid' : 'none'
      }), [])

   return (
      <form method="post" onSubmit={onSubmit} id="settings">
         <div className="flex items-end gap-x-3">
            <Input className="flex-grow" name="apiKey" label="API Key" defaultValue={process.env.NEXT_PUBLIC_BINANCE_API_KEY} />
            <Input className="flex-grow" name="apiSecret" label="Secret Key" defaultValue={process.env.NEXT_PUBLIC_BINANCE_API_SECRET} type="password" />
            <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500">Fetch</button>
         </div>
      </form>
   )
}

const onSubmit = event => {
   event.preventDefault()
   eventBus.dispatch('api.form.submitted', new URLSearchParams(new FormData(event.target)))
}
