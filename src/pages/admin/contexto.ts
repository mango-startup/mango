import { createContext } from 'react'
import type { AdminEu } from '../../lib/admin.ts'

export interface ContextoAdmin {
  admin: AdminEu
  sair: () => Promise<void>
}

export const Contexto = createContext<ContextoAdmin | null>(null)
