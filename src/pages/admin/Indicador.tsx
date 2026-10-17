import type { Dupla } from '../../lib/admin.ts'
import { Cartao } from './ui'

/** Variação em relação ao período anterior. Sem base de comparação (anterior = 0) não inventa percentual. */
export function Variacao({ dupla, invertido = false }: { dupla: Dupla; invertido?: boolean }) {
  if (dupla.anterior === 0) return <span className="text-muted">{dupla.atual === 0 ? 'sem movimento' : 'novo no período'}</span>
  const pct = ((dupla.atual - dupla.anterior) / dupla.anterior) * 100
  if (Math.abs(pct) < 0.5) return <span className="text-muted">igual ao período anterior</span>
  const bom = invertido ? pct < 0 : pct > 0
  return (
    <span className={bom ? 'text-paper' : 'text-danger-ink'}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0).replace('.', ',')}% <span className="text-muted">vs. período anterior</span>
    </span>
  )
}

export function Indicador({ rotulo, valor, dupla, detalhe }: { rotulo: string; valor: string | number; dupla?: Dupla; detalhe?: string }) {
  return (
    <Cartao>
      <p className="text-sm text-muted">{rotulo}</p>
      <p className="mt-1 font-display text-[34px] leading-none tabular-nums">{valor}</p>
      <p className="mt-2 text-[13px]">{dupla ? <Variacao dupla={dupla} /> : <span className="text-muted">{detalhe}</span>}</p>
    </Cartao>
  )
}
