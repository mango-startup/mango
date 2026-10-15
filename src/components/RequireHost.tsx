import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'

// Rotas do anfitrião: sem acesso guardado neste aparelho, manda para /entrar.
// É só conforto de navegação; quem barra de verdade é a api (token inválido = nao_autorizado).
export function RequireHost({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!api.anfitriaoNesteAparelho()) {
    return <Navigate to="/entrar" replace state={{ de: location.pathname }} />
  }
  return children
}
