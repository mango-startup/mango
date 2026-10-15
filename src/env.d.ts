/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'real' ou 'simulada'. Sem valor: real em produção, simulada no desenvolvimento. */
  readonly VITE_API?: 'real' | 'simulada'
}
