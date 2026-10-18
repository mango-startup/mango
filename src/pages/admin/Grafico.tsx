// Gráficos mínimos em SVG, sem dependência. Cor herdada do texto (currentColor).

/** Linha pequena de tendência, para dentro de cartões de número. */
export function Tendencia({ valores, className = 'h-10 w-full' }: { valores: number[]; className?: string }) {
  if (valores.length < 2) return <div className={className} />
  const max = Math.max(...valores, 1)
  const passo = 100 / (valores.length - 1)
  const pontos = valores.map((v, i) => `${(i * passo).toFixed(2)},${(36 - (v / max) * 32).toFixed(2)}`)
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" className={`${className} text-paper/70`}>
      <polygon points={`0,40 ${pontos.join(' ')} 100,40`} fill="currentColor" opacity={0.08} />
      <polyline points={pontos.join(' ')} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Colunas por dia, com rótulo acessível em cada uma. */
export function Colunas({ itens, formatar = String }: { itens: { rotulo: string; valor: number }[]; formatar?: (v: number) => string }) {
  const max = Math.max(...itens.map((i) => i.valor), 1)
  return (
    <div className="flex h-40 items-end gap-[3px]" role="img" aria-label={itens.map((i) => `${i.rotulo}: ${formatar(i.valor)}`).join('; ')}>
      {itens.map((i) => (
        <div key={i.rotulo} title={`${i.rotulo}: ${formatar(i.valor)}`} className="min-w-0 flex-1 rounded-t-[3px] bg-paper/70 transition-colors hover:bg-paper" style={{ height: `${Math.max((i.valor / max) * 100, i.valor > 0 ? 3 : 0.5)}%` }} />
      ))}
    </div>
  )
}

/** Barras horizontais com rótulo e número, para distribuições (eventos por estado). */
export function Barras({ itens }: { itens: { rotulo: string; valor: number }[] }) {
  const max = Math.max(...itens.map((i) => i.valor), 1)
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <div className="mb-1 flex justify-between text-[14px]">
            <span>{i.rotulo}</span>
            <span className="tabular-nums text-muted">{i.valor}</span>
          </div>
          <div className="h-1.5 rounded-full bg-line">
            <div className="h-full rounded-full bg-paper/80" style={{ width: `${(i.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
