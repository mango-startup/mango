import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BlocoEstado } from '../../components/BlocoEstado'
import { Botao } from '../../components/Botao'
import { Quadro } from '../../components/Quadro'
import { ErroApi, api, type EventoPublico, type Eu, type FotoAlbum } from '../../lib/api'
import { dataPorExtenso } from '../../lib/datas'
import { CascaConvite } from './CascaConvite'

interface AlbumProps {
  codigo: string
  evento: EventoPublico
  /** null quando este aparelho não fotografou: some o filtro "Minhas". */
  eu: Eu | null
  /** O álbum ficou indisponível (privado, expirado): recarregar o convite. */
  onMudou: () => void
}

type Filtro = 'todas' | 'minhas'

interface Lista {
  fotos: FotoAlbum[]
  total: number
  pagina: number
  carregando: boolean
  erro: boolean
}

const POR_PAGINA = 60
const LISTA_VAZIA: Lista = { fotos: [], total: 0, pagina: 0, carregando: true, erro: false }

// Folha de contato: grade regular, número do quadro e quem fotografou, carregando por páginas.
export function Album({ codigo, evento, eu, onMudou }: AlbumProps) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [lista, setLista] = useState<Lista>(LISTA_VAZIA)
  const fim = useRef<HTMLDivElement>(null)

  const buscar = useCallback(
    async (pagina: number, qual: Filtro): Promise<Partial<Lista>> => {
      try {
        const r = await api.album(codigo, { pagina, limite: POR_PAGINA, minhas: qual === 'minhas' })
        return { fotos: r.fotos, total: r.total, pagina, carregando: false, erro: false }
      } catch (e) {
        if (e instanceof ErroApi && ['album_privado', 'expirado', 'nao_revelado'].includes(e.erro)) onMudou()
        return { carregando: false, erro: true }
      }
    },
    [codigo, onMudou],
  )

  // Primeira página (e de novo ao trocar o filtro)
  useEffect(() => {
    let ativo = true
    buscar(1, filtro).then((r) => ativo && setLista({ ...LISTA_VAZIA, ...r }))
    return () => {
      ativo = false
    }
  }, [buscar, filtro])

  const temMais = lista.fotos.length < lista.total

  const carregarPagina = useCallback(
    (pagina: number) => {
      setLista((l) => ({ ...l, carregando: true, erro: false }))
      buscar(pagina, filtro).then((r) =>
        setLista((l) => ({ ...l, ...r, fotos: r.fotos ? [...l.fotos, ...r.fotos] : l.fotos })),
      )
    },
    [buscar, filtro],
  )

  const proxima = useCallback(() => {
    if (!lista.carregando && !lista.erro && temMais) carregarPagina(lista.pagina + 1)
  }, [carregarPagina, lista, temMais])

  // Carrega a próxima página quando o fim da grade chega perto da tela
  useEffect(() => {
    const alvo = fim.current
    if (!alvo || !temMais) return
    const observador = new IntersectionObserver(([entrada]) => entrada.isIntersecting && proxima(), { rootMargin: '600px' })
    observador.observe(alvo)
    return () => observador.disconnect()
  }, [proxima, temMais])

  const vazio = !lista.carregando && !lista.erro && lista.total === 0

  return (
    <CascaConvite evento={evento.nome}>
      <div className="mx-auto w-full max-w-[1100px] px-3 pb-8 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-2 pt-4">
          <div>
            <h1 className="font-display text-[36px] leading-none [text-wrap:balance] sm:text-[44px]">{evento.nome}</h1>
            <p className="mt-2 text-[15px] text-muted tabular-nums">
              {lista.carregando && lista.pagina === 0 ? 'Revelando...' : `${lista.total} ${lista.total === 1 ? 'foto' : 'fotos'}`}
            </p>
          </div>
          {eu && (
            <div role="group" aria-label="Quais fotos mostrar" className="flex rounded-[14px] border border-line p-1">
              {(['todas', 'minhas'] as const).map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  aria-pressed={filtro === opcao}
                  onClick={() => {
                    if (opcao === filtro) return
                    setLista(LISTA_VAZIA)
                    setFiltro(opcao)
                  }}
                  className={`min-h-10 rounded-[10px] px-4 text-sm font-semibold transition-colors ${
                    filtro === opcao ? 'bg-paper text-base' : 'text-muted hover:text-paper'
                  }`}
                >
                  {opcao === 'todas' ? 'Todas' : 'Minhas'}
                </button>
              ))}
            </div>
          )}
        </div>

        {vazio && (
          <BlocoEstado
            className="py-16"
            titulo={filtro === 'minhas' ? 'Nenhuma foto sua' : 'O rolo veio vazio'}
            texto={filtro === 'minhas' ? 'As fotos que você tirou com este aparelho aparecem aqui.' : 'Ninguém fotografou neste evento.'}
          />
        )}

        {lista.fotos.length > 0 && (
          <ul className="mt-6 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
            {lista.fotos.map((foto) => (
              <li key={foto.id}>
                <Quadro src={foto.miniatura_url} numero={foto.numero} apelido={foto.apelido} para={`/c/${codigo}/f/${foto.id}`} />
              </li>
            ))}
          </ul>
        )}

        <div ref={fim} />
        {lista.carregando && lista.pagina > 0 && (
          <p role="status" className="py-6 text-center text-sm text-muted">
            Carregando mais fotos...
          </p>
        )}
        {lista.erro && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-danger-ink">Não foi possível carregar as fotos.</p>
            <Botao variante="secundario" onClick={() => carregarPagina(lista.pagina + 1)}>
              Tentar de novo
            </Botao>
          </div>
        )}

        <footer className="mt-10 flex flex-col items-center gap-2 border-t border-line pt-5 text-center text-sm text-muted">
          {evento.expira_em && <p>Disponível até {dataPorExtenso(evento.expira_em)}</p>}
          <p>
            Feito com Mango ·{' '}
            <Link to="/" className="font-semibold text-paper underline underline-offset-2">
              crie a sua
            </Link>
          </p>
        </footer>
      </div>
    </CascaConvite>
  )
}
