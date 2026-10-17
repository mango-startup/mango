import { Botao } from '../../components/Botao'

export function Paginacao({ pagina, limite, total, aoMudar }: { pagina: number; limite: number; total: number; aoMudar: (pagina: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / limite))
  if (paginas <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between">
      <Botao variante="secundario" onClick={() => aoMudar(pagina - 1)} disabled={pagina <= 1}>
        Anteriores
      </Botao>
      <span className="text-sm text-muted">
        Página {pagina} de {paginas}
      </span>
      <Botao variante="secundario" onClick={() => aoMudar(pagina + 1)} disabled={pagina >= paginas}>
        Próximos
      </Botao>
    </div>
  )
}
