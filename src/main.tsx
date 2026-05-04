import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './tiles/builtin'
import './groups/builtin'
import './games/builtin'
import { loadPluginsFromQuery } from './plugin/loader'

async function bootstrap() {
  // External plugins specified via ?plugin=URL query params are loaded before
  // first render so SetupModal & co. see plugin-registered modes/kinds/groups.
  await loadPluginsFromQuery()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
