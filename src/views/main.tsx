import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app'
import { API_BASE, isMockMode } from './lib/fetcher'
import migrateLegacyCredentials from './lib/migrate-credentials'

if (!isMockMode) {
   await migrateLegacyCredentials(API_BASE)
}

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root element to mount into.')

createRoot(root).render(
   <StrictMode>
      <App />
   </StrictMode>
)
