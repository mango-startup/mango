import { useContext } from 'react'
import { Contexto } from './contexto'

/** Como `useAdmin`, mas devolve null fora da área logada (a troca de senha obrigatória roda antes do contexto existir). */
export function useAdminOpcional() {
  return useContext(Contexto)
}
