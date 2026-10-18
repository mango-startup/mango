import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BlocoEstado } from '../components/BlocoEstado'
import { Botao } from '../components/Botao'
import { Confirmacao } from '../components/Confirmacao'
import { Icone } from '../components/Icone'
import { MangoLogo } from '../components/MangoLogo'
import { Quadro } from '../components/Quadro'
import { ErroApi, api, type FotoAlbum, type PainelEvento, type PedidoRemocao } from '../lib/api'

const POR_PAGINA = 120

interface Dados {
  painel: PainelEvento
  fotos: FotoAlbum[]
  total: number
  pagina: number
  pedidos: PedidoRemocao[]
}

// /eventos/:id/moderacao — o anfitrião vê e apaga fotos (inclusive antes da revelação) e responde aos pedidos de remoção.
export function ModerationPage() {
  const { id = '' } = useParams()
  const [dados, setDados] = useState<Dados | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const [apagando, setApagando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const ler = useCallback(async (): Promise<Dados> => {
    const [painel, pagina, pedidos] = await Promise.all([api.painel(id), api.albumDoAnfitriao(id, { pagina: 1, limite: POR_PAGINA }), api.pedidosDeRemocao(id)])
    return { painel, fotos: pagina.fotos, total: pagina.total, pagina: 1, pedidos }
  }, [id])

  const mensagemDeFalha = (e: unknown) =>
    e instanceof ErroApi && e.erro === 'expirado'
      ? 'O álbum deste evento expirou e as fotos foram apagadas.'
      : e instanceof ErroApi && e.erro === 'nao_autorizado'
        ? 'Este aparelho não tem acesso a este evento.'
        : 'Não deu para carregar as fotos.'

  useEffect(() => {
    let ativo = true
    ler().then(
      (d) => ativo && setDados(d),
      (e: unknown) => ativo && setFalha(mensagemDeFalha(e)),
    )
    return () => {
      ativo = false
    }
  }, [ler])

  async function recarregar() {
    try {
      setDados(await ler())
    } catch (e) {
      setFalha(mensagemDeFalha(e))
    }
  }

  async function carregarMais() {
    if (!dados) return
    setCarregandoMais(true)
    try {
      const r = await api.albumDoAnfitriao(id, { pagina: dados.pagina + 1, limite: POR_PAGINA })
      setDados({ ...dados, fotos: [...dados.fotos, ...r.fotos], total: r.total, pagina: dados.pagina + 1 })
    } catch {
      setAviso('Não deu para carregar mais fotos.')
    } finally {
      setCarregandoMais(false)
    }
  }

  async function apagar(fotoId: string) {
    setOcupado(true)
    setAviso(null)
    try {
      await api.apagarFoto(id, fotoId)
      setApagando(null)
      setAviso('Foto apagada.')
      await recarregar()
    } catch (e) {
      setAviso(e instanceof ErroApi ? e.message : 'Não deu para apagar a foto.')
    } finally {
      setOcupado(false)
    }
  }

  async function manter(pedidoId: string) {
    try {
      await api.manterFoto(id, pedidoId)
      setAviso('Pedido respondido: a foto continua no álbum.')
      await recarregar()
    } catch (e) {
      setAviso(e instanceof ErroApi ? e.message : 'Não deu para responder o pedido.')
    }
  }

  const voltar = (
    <Link to={`/eventos/${id}`} className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-[15px] font-semibold text-muted transition hover:text-paper">
      <Icone nome="voltar" className="h-5 w-5" />
      Painel
    </Link>
  )

  if (falha || !dados) {
    return (
      <Casca voltar={voltar}>
        {falha ? (
          <BlocoEstado className="py-16" titulo="Moderação indisponível" texto={falha} acao={<Botao para={`/eventos/${id}`}>Voltar ao painel</Botao>} />
        ) : (
          <p role="status" className="py-16 text-center text-[15px] text-muted">
            Carregando as fotos...
          </p>
        )}
      </Casca>
    )
  }

  const { painel, fotos, total, pedidos } = dados
  const antesDaRevelacao = painel.evento.estado !== 'revelado'
  const fotoDoPedido = (p: PedidoRemocao) => fotos.find((f) => f.id === p.foto_id)

  return (
    <Casca voltar={voltar}>
      <h1 className="font-display text-[40px] leading-none">Moderar fotos</h1>
      <p className="mt-3 text-[15px] text-muted">{painel.evento.nome}</p>

      {antesDaRevelacao && (
        <p className="mt-6 flex gap-3 rounded-[14px] border border-line p-4 text-sm leading-normal">
          <Icone nome="alerta" className="h-5 w-5 shrink-0 text-muted" />
          Você está vendo as fotos antes da revelação. Para os convidados, continua surpresa. Se quiser a surpresa também, volte depois.
        </p>
      )}

      {aviso && (
        <p role="status" className="mt-6 text-sm text-muted">
          {aviso}
        </p>
      )}

      {pedidos.length > 0 && (
        <section className="mt-10" aria-labelledby="titulo-pedidos">
          <h2 id="titulo-pedidos" className="text-sm font-semibold">
            Pedidos de remoção · {pedidos.length}
          </h2>
          <ul className="mt-3 flex flex-col border-t border-line">
            {pedidos.map((p) => {
              const foto = fotoDoPedido(p)
              return (
                <li key={p.id} className="flex gap-4 border-b border-line py-4">
                  <div className="w-20 shrink-0">{foto ? <Quadro src={foto.miniatura_url} numero={p.numero} apelido={foto.apelido} /> : null}</div>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <p className="text-[15px]">
                      Foto {String(p.numero).padStart(3, '0')}
                      {p.motivo ? <span className="block text-sm text-muted">“{p.motivo}”</span> : <span className="block text-sm text-muted">Sem motivo informado.</span>}
                    </p>
                    {apagando === p.foto_id ? (
                      <Confirmacao
                        pergunta="Apagar esta foto?"
                        detalhe="Ela some do álbum para todos."
                        rotuloConfirmar="Apagar"
                        rotuloCarregando="Apagando..."
                        carregando={ocupado}
                        destrutiva
                        onConfirmar={() => void apagar(p.foto_id)}
                        onCancelar={() => setApagando(null)}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Botao variante="destrutivo" className="min-h-11 px-4" onClick={() => setApagando(p.foto_id)}>
                          Apagar a foto
                        </Botao>
                        <Botao variante="secundario" className="min-h-11 px-4" onClick={() => void manter(p.id)}>
                          Manter
                        </Botao>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-10" aria-labelledby="titulo-fotos">
        <h2 id="titulo-fotos" className="text-sm font-semibold tabular-nums">
          Todas as fotos · {total}
        </h2>
        {fotos.length === 0 ? (
          <p className="py-10 text-[15px] text-muted">Nenhuma foto ainda.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
            {fotos.map((foto) => (
              <li key={foto.id} className="relative">
                <Quadro src={foto.miniatura_url} numero={foto.numero} apelido={foto.apelido} />
                {apagando === foto.id && !pedidos.some((p) => p.foto_id === foto.id) ? (
                  <div className="absolute inset-x-0 top-0 flex aspect-[3/4] items-center rounded-[10px] bg-base/90 p-2 backdrop-blur-sm">
                    <Confirmacao
                      pergunta="Apagar?"
                      rotuloConfirmar="Apagar"
                      rotuloCarregando="..."
                      carregando={ocupado}
                      destrutiva
                      className="[&_button]:min-h-10 [&_button]:px-3 [&_button]:text-sm"
                      onConfirmar={() => void apagar(foto.id)}
                      onCancelar={() => setApagando(null)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setApagando(foto.id)}
                    aria-label={`Apagar foto ${foto.numero}`}
                    className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-base/60 backdrop-blur-sm transition hover:bg-base/80"
                  >
                    <Icone nome="lixeira" className="h-5 w-5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {fotos.length < total && (
          <div className="mt-6 flex justify-center">
            <Botao variante="secundario" disabled={carregandoMais} onClick={() => void carregarMais()}>
              {carregandoMais ? 'Carregando...' : `Carregar mais (${total - fotos.length})`}
            </Botao>
          </div>
        )}
      </section>
    </Casca>
  )
}

function Casca({ voltar, children }: { voltar: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-base px-5 pb-12 pt-[env(safe-area-inset-top)] text-paper">
      <header className="mx-auto flex min-h-16 max-w-[720px] items-center justify-between">
        {voltar}
        <Link to="/" aria-label="Mango, página inicial" className="flex min-h-11 items-center">
          <MangoLogo className="h-[21px] w-4" />
        </Link>
      </header>
      <main className="mx-auto mt-6 max-w-[720px]">{children}</main>
    </div>
  )
}
