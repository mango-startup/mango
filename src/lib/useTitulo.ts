import { useEffect } from 'react'

const TITULO_PADRAO = 'Mango — câmera descartável digital para festas'

// Título da aba por página; volta ao padrão quando a página sai da tela.
export function useTitulo(titulo?: string) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Mango` : TITULO_PADRAO
    return () => {
      document.title = TITULO_PADRAO
    }
  }, [titulo])
}
