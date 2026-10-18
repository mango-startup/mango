import { useEffect, useState } from 'react'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarReais, type Crescimento as Dados } from '../../lib/admin.ts'
import { Colunas } from './Grafico'
import { Aviso, Cartao, Titulo, Carregando } from './ui'
import { campoTexto } from './util'

const METRICAS = { eventos: 'Eventos criados', convidados: 'Convidados', fotos: 'Fotos', receita_centavos: 'Receita' } as const
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
      {!dados && !erro && <Carregando />}
      {dados && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(METRICAS) as Metrica[]).map((m) => (
              <Cartao key={m}>
                <p className="text-sm text-muted">{METRICAS[m]}</p>
                <p className="mt-1 font-display text-[38px] leading-none tabular-nums">{m === 'receita_centavos' ? formatarReais(dados.totais[m]) : dados.totais[m]}</p>
                <p className="mt-2 text-[13px] text-muted">nos últimos {dados.dias} dias</p>
              </Cartao>
            ))}
          </div>
          <Cartao>
            <h2 className="mb-4 text-sm font-semibold">{METRICAS[metrica]} por dia</h2>
            <Colunas itens={dados.serie.map((d) => ({ rotulo: diaCurto(d.dia), valor: d[metrica] }))} formatar={metrica === 'receita_centavos' ? formatarReais : String} />
          </Cartao>
        </div>
      )}
    </>
  )
}
