import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { API_BASE, isMockMode } from './app'
import migrateLegacyCredentials from './lib/migrate-credentials'

if (!isMockMode) {
   await migrateLegacyCredentials(API_BASE)
}

createRoot(document.getElementById('root')).render(
   <StrictMode>
      <App />
   </StrictMode>
)
