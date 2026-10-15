import { useContext } from 'react'
import { Contexto, type ContextoAdmin } from './contexto'

export function useAdmin(): ContextoAdmin {
  const c = useContext(Contexto)
  if (!c) throw new Error('useAdmin só vale dentro da área de admin')
  return c
}
