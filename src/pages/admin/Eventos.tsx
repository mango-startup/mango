import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarBytes, urlCsv, type FiltroEventos, type PaginaEventos } from '../../lib/admin.ts'
import { Paginacao } from './Paginacao'
import { Aviso, Cartao, Titulo } from './ui'
import { Input } from '@/components/ui/input'
import { campoTexto, dataHora, ESTADOS_EVENTO } from './util'

export function Eventos() {
  const [estado, setEstado] = useState('')
  const [pacote, setPacote] = useState('')
  const [ordem, setOrdem] = useState('recentes')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [pacotes, setPacotes] = useState<string[]>([])
  const [dados, setDados] = useState<PaginaEventos | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // A busca só dispara depois de uma pausa na digitação.
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca.trim())
      setPagina(1)
    }, 350)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    admin.pacotes().then((l) => setPacotes(l.map((p) => p.id))).catch(() => {})
  }, [])

  useEffect(() => {
    let ativo = true
    const filtro: FiltroEventos = { estado, pacote, busca: buscaAplicada, ordem, de, ate }
    admin
      .eventos(filtro, pagina)
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [estado, pacote, buscaAplicada, ordem, de, ate, pagina])

  const filtrar = (definir: (v: string) => void) => (e: { target: { value: string } }) => {
    definir(e.target.value)
    setPagina(1)
  }

  return (
    <>
      <Titulo detalhe="Todos os eventos criados, do mais novo para o mais antigo. Filtre por estado, pacote ou procure pelo nome do evento e e-mail do anfitrião.">Eventos</Titulo>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input type="search" aria-label="Buscar evento ou anfitrião" placeholder="Buscar evento ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select aria-label="Estado" value={estado} onChange={filtrar(setEstado)} className={campoTexto}>
          <option value="">Todos os estados</option>
          {Object.entries(ESTADOS_EVENTO).map(([id, rotulo]) => (
            <option key={id} value={id}>
              {rotulo}
            </option>
          ))}
        </select>
        <select aria-label="Pacote" value={pacote} onChange={filtrar(setPacote)} className={campoTexto}>
          <option value="">Todos os pacotes</option>
          {pacotes.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <select aria-label="Ordenar por" value={ordem} onChange={filtrar(setOrdem)} className={campoTexto}>
          <option value="recentes">Mais recentes primeiro</option>
          <option value="antigos">Mais antigos primeiro</option>
          <option value="fotos">Mais fotos</option>
          <option value="convidados">Mais convidados</option>
          <option value="armazenamento">Maior armazenamento</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          De
          <Input type="date" value={de} onChange={filtrar(setDe)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Até
          <Input type="date" value={ate} onChange={filtrar(setAte)} />
        </label>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <p className="text-muted">Carregando...</p>}
      {dados && (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm text-muted">{dados.total} {dados.total === 1 ? 'evento' : 'eventos'}</p>
            <a href={urlCsv('eventos', { estado, pacote, busca: buscaAplicada, ordem, de, ate })} download className="text-sm font-semibold underline underline-offset-4 hover:text-paper">
              Exportar CSV
            </a>
          </div>
          <Cartao className="overflow-x-auto p-0">
            {dados.eventos.length === 0 ? (
              <p className="p-5 text-muted">Nenhum evento com esses filtros.</p>
            ) : (
              <table className="w-full min-w-[920px] text-left text-[14px]">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Evento</th>
                    <th className="px-4 py-3 font-semibold">Anfitrião</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Pacote</th>
                    <th className="px-4 py-3 text-right font-semibold">Convidados</th>
                    <th className="px-4 py-3 text-right font-semibold">Fotos</th>
                    <th className="px-4 py-3 text-right font-semibold">Armazenamento</th>
                    <th className="px-4 py-3 font-semibold">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dados.eventos.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3">
                        <Link to={`/admin/eventos/${e.id}`} className="underline underline-offset-4 hover:text-muted">
                          {e.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{e.anfitriao_email}</td>
                      <td className="px-4 py-3">{ESTADOS_EVENTO[e.estado] ?? e.estado}</td>
                      <td className="px-4 py-3 text-muted">{e.pacote}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {e.convidados}
                        <span className="text-muted"> / {e.limite_convidados}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{e.fotos}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{formatarBytes(e.armazenamento_bytes)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{dataHora(e.criado_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>
          <Paginacao pagina={dados.pagina} limite={dados.limite} total={dados.total} aoMudar={setPagina} />
        </>
      )}
    </>
  )
}
