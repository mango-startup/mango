import { useConfigPublica } from '../lib/configPublica'

// Faixa de aviso do site inteiro (admin > Configurações > "Aviso para todos os visitantes"). Vazio = não aparece.
export function AvisoGlobal() {
  const { aviso_global: aviso } = useConfigPublica()
  if (!aviso.trim()) return null
  return (
    <p role="status" className="border-b border-line bg-surface px-4 py-2 text-center text-sm text-paper">
      {aviso}
    </p>
  )
}
