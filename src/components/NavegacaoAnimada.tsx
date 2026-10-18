import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Navegação nova abre no topo e o botão voltar deixa o navegador restaurar a rolagem.
// Cada rota nova entra com um fade curto (o admin fica de fora: tem layout próprio e já mantém o estado).
export function NavegacaoAnimada({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation()
  const tipo = useNavigationType()
  const admin = pathname.startsWith('/admin')

  useEffect(() => {
    if (tipo !== 'POP' && !hash) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash, tipo])

  return (
    <div key={admin ? 'admin' : pathname} className={admin ? undefined : 'anim-rota'}>
      {children}
    </div>
  )
}
