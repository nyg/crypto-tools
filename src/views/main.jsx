import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { isMockMode } from './app'

if (isMockMode) {
   const { initMockCredentials } = await import('./mocks')
   initMockCredentials()
}

createRoot(document.getElementById('root')).render(
   <StrictMode>
      <App />
   </StrictMode>
)
