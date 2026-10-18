import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarBytes, urlCsv, type FiltroEventos, type PaginaEventos } from '../../lib/admin.ts'
import { Paginacao } from './Paginacao'
import { Aviso, Cartao, Carregando, EstadoVazio, ExportarCsv, Titulo } from './ui'
import { campoTexto, dataHora, ESTADOS_EVENTO, rotuloEmail } from './util'
import { useFiltrosUrl } from './useFiltrosUrl'
import { useNomesPacotes } from './usePacotes'

const PADRAO = { busca: '', estado: '', pacote: '', ordem: 'recentes', de: '', ate: '', limite: '25', pagina: '1' }

export function Eventos() {
  const nomePacote = useNomesPacotes()
  const { valores: f, definir, limpar, ativos } = useFiltrosUrl(PADRAO)
  // O que se digita na busca vai para a URL só depois de uma pausa.
  const [digitado, setDigitado] = useState(f.busca)
  const [pacotes, setPacotes] = useState<string[]>([])
  const [dados, setDados] = useState<PaginaEventos | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (digitado.trim() === f.busca) return
    const t = setTimeout(() => definir({ busca: digitado.trim() }), 350)
    return () => clearTimeout(t)
  })

  useEffect(() => {
    admin.pacotes().then((l) => setPacotes(l.map((p) => p.id))).catch(() => {})
  }, [])

  useEffect(() => {
    let ativo = true
    const filtro: FiltroEventos = { estado: f.estado, pacote: f.pacote, busca: f.busca, ordem: f.ordem, de: f.de, ate: f.ate, limite: f.limite }
    admin
      .eventos(filtro, Number(f.pagina) || 1)
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [f.estado, f.pacote, f.busca, f.ordem, f.de, f.ate, f.limite, f.pagina])

  const muda = (chave: keyof typeof PADRAO) => (e: { target: { value: string } }) => definir({ [chave]: e.target.value })

  return (
    <>
      <Titulo detalhe="Todos os eventos criados. Filtre por estado, pacote ou período, procure pelo nome do evento ou e-mail do anfitrião, e ordene pela câmera mais próxima. Os filtros ficam no endereço da página.">Eventos</Titulo>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input type="search" aria-label="Buscar evento ou anfitrião" placeholder="Buscar evento ou e-mail" value={digitado} onChange={(e) => setDigitado(e.target.value)} />
        <select aria-label="Estado" value={f.estado} onChange={muda('estado')} className={campoTexto}>
          <option value="">Todos os estados</option>
          {Object.entries(ESTADOS_EVENTO).map(([id, rotulo]) => (
            <option key={id} value={id}>
              {rotulo}
            </option>
          ))}
        </select>
        <select aria-label="Pacote" value={f.pacote} onChange={muda('pacote')} className={campoTexto}>
          <option value="">Todos os pacotes</option>
          {pacotes.map((id) => (
            <option key={id} value={id}>
              {nomePacote(id)}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <select aria-label="Ordenar por" value={f.ordem} onChange={muda('ordem')} className={campoTexto}>
          <option value="recentes">Mais recentes primeiro</option>
          <option value="antigos">Mais antigos primeiro</option>
          <option value="camera">Câmera mais próxima</option>
          <option value="fotos">Mais fotos</option>
          <option value="convidados">Mais convidados</option>
          <option value="armazenamento">Maior armazenamento</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          De
          <Input type="date" value={f.de} onChange={muda('de')} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Até
          <Input type="date" value={f.ate} onChange={muda('ate')} />
        </label>
        <select aria-label="Itens por página" value={f.limite} onChange={muda('limite')} className={campoTexto}>
          {['25', '50', '100'].map((n) => (
            <option key={n} value={n}>
              {n} por página
            </option>
          ))}
        </select>
      </div>
      {ativos > 0 && (
        <div className="mb-4">
          <Button type="button" variant="ghost" onClick={() => { limpar(); setDigitado('') }}>
            Limpar {ativos} filtro{ativos > 1 ? 's' : ''}
          </Button>
        </div>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <Carregando />}
      {dados && (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm text-muted">{dados.total} {dados.total === 1 ? 'evento' : 'eventos'}</p>
            <ExportarCsv href={urlCsv('eventos', { estado: f.estado, pacote: f.pacote, busca: f.busca, ordem: f.ordem, de: f.de, ate: f.ate })} />
          </div>
          <Cartao className="overflow-x-auto p-0">
            {dados.eventos.length === 0 ? (
              <EstadoVazio acao={ativos > 0 ? <Button type="button" variant="outline" onClick={() => { limpar(); setDigitado('') }}>Limpar filtros</Button> : undefined}>Nenhum evento com esses filtros.</EstadoVazio>
            ) : (
              <table className="tabela-cards w-full text-left text-[14px] sm:min-w-[1020px]">
                <thead className="sticky top-0 border-b border-line bg-surface text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Evento</th>
                    <th className="px-4 py-3 font-semibold">Anfitrião</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Pacote</th>
                    <th className="px-4 py-3 font-semibold">Câmera abre</th>
                    <th className="px-4 py-3 text-right font-semibold">Convidados</th>
                    <th className="px-4 py-3 text-right font-semibold">Fotos</th>
                    <th className="px-4 py-3 text-right font-semibold">Armazenamento</th>
                    <th className="px-4 py-3 font-semibold">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line [&_tr:hover]:bg-surface/70">
                  {dados.eventos.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3">
                        <Link to={`/admin/eventos/${e.id}`} className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-muted">
                          {e.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{rotuloEmail(e.anfitriao_email)}</td>
                      <td className="px-4 py-3">{ESTADOS_EVENTO[e.estado] ?? e.estado}</td>
                      <td className="px-4 py-3 text-muted">{nomePacote(e.pacote)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{dataHora(e.captura_inicio)}</td>
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
          <Paginacao pagina={dados.pagina} limite={dados.limite} total={dados.total} aoMudar={(n) => definir({ pagina: String(n) })} />
        </>
      )}
    </>
  )
}
