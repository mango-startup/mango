import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { apiPronta } from './lib/api'

// Espera a api ficar pronta para as rotas do anfitrião já saberem se há acesso neste aparelho.
apiPronta.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
