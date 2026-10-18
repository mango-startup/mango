import { Button } from '@/components/ui/button'

export function Paginacao({ pagina, limite, total, aoMudar }: { pagina: number; limite: number; total: number; aoMudar: (pagina: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / limite))
  if (paginas <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between">
      <Button variant="outline" onClick={() => aoMudar(pagina - 1)} disabled={pagina <= 1}>
        Anteriores
      </Button>
      <span className="text-sm text-muted">
        Página {pagina} de {paginas}
      </span>
      <Button variant="outline" onClick={() => aoMudar(pagina + 1)} disabled={pagina >= paginas}>
        Próximos
      </Button>
    </div>
  )
}
