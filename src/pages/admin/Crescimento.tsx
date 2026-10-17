import { useEffect, useState } from 'react'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type Crescimento as Dados } from '../../lib/admin.ts'
import { Aviso, Cartao, Titulo } from './ui'
import { campoTexto } from './util'

const METRICAS = { eventos: 'Eventos criados', convidados: 'Convidados', fotos: 'Fotos' } as const
type Metrica = keyof typeof METRICAS

function diaCurto(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function Crescimento() {
  const [dias, setDias] = useState(30)
  const [metrica, setMetrica] = useState<Metrica>('eventos')
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    admin
      .crescimento(dias)
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [dias])

  const maximo = dados ? Math.max(1, ...dados.serie.map((d) => d[metrica])) : 1

  return (
    <>
      <Titulo detalhe="Quanto o Mango cresceu por dia (fuso de São Paulo). Escolha o período e o que quer acompanhar.">Crescimento</Titulo>
      <div className="mb-4 grid gap-3 sm:max-w-[520px] sm:grid-cols-2">
        <select aria-label="Período" value={dias} onChange={(e) => setDias(Number(e.target.value))} className={campoTexto}>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
          <option value={365}>Último ano</option>
        </select>
        <select aria-label="Métrica" value={metrica} onChange={(e) => setMetrica(e.target.value as Metrica)} className={campoTexto}>
          {Object.entries(METRICAS).map(([id, rotulo]) => (
            <option key={id} value={id}>
              {rotulo}
            </option>
          ))}
        </select>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <p className="text-muted">Carregando...</p>}
      {dados && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {(Object.keys(METRICAS) as Metrica[]).map((m) => (
              <Cartao key={m}>
                <p className="text-sm text-muted">{METRICAS[m]}</p>
                <p className="mt-1 font-display text-[38px] leading-none tabular-nums">{dados.totais[m]}</p>
                <p className="mt-2 text-[13px] text-muted">nos últimos {dados.dias} dias</p>
              </Cartao>
            ))}
          </div>
          <Cartao>
            <h2 className="mb-4 text-sm font-semibold">{METRICAS[metrica]} por dia</h2>
            <div className="flex h-44 items-end gap-px" role="img" aria-label={`${METRICAS[metrica]} por dia, de ${diaCurto(dados.serie[0].dia)} a ${diaCurto(dados.serie[dados.serie.length - 1].dia)}`}>
              {dados.serie.map((d) => (
                <div key={d.dia} title={`${diaCurto(d.dia)}: ${d[metrica]}`} className="flex h-full min-w-px flex-1 items-end">
                  <div className="w-full rounded-t-[2px] bg-paper" style={{ height: `${(d[metrica] / maximo) * 100}%`, minHeight: d[metrica] > 0 ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>{diaCurto(dados.serie[0].dia)}</span>
              <span>pico: {maximo > 1 || dados.serie.some((d) => d[metrica] > 0) ? maximo : 0}</span>
              <span>{diaCurto(dados.serie[dados.serie.length - 1].dia)}</span>
            </div>
          </Cartao>
        </div>
      )}
    </>
  )
}
