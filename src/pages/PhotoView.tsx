import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BlocoEstado } from '../components/BlocoEstado'
import { Botao } from '../components/Botao'
import { Confirmacao } from '../components/Confirmacao'
import { Icone } from '../components/Icone'
import { ErroApi, api, type FotoAlbum } from '../lib/api'

type Carga =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'ok'; fotos: FotoAlbum[]; nome: string }

const POR_PAGINA = 200
const DESLIZE_MIN_PX = 50

/** Busca o álbum inteiro em páginas de 200 (a navegação anterior/próxima precisa da ordem toda). */
async function lerAlbum(codigo: string): Promise<Carga> {
  try {
    const fotos: FotoAlbum[] = []
    let pagina = 1
    let nome = ''
    for (;;) {
      const r = await api.album(codigo, { pagina, limite: POR_PAGINA })
      nome = r.evento.nome
      fotos.push(...r.fotos)
      if (fotos.length >= r.total || r.fotos.length === 0) break
      pagina++
    }
    return { tipo: 'ok', fotos, nome }
  } catch (e) {
    return { tipo: 'erro', mensagem: e instanceof ErroApi ? e.message : 'Não deu para carregar a foto.' }
  }
}

const nomeDoArquivo = (codigo: string, foto: FotoAlbum) => `mango-${codigo.toLowerCase()}-${String(foto.numero).padStart(3, '0')}.jpg`

async function arquivoDa(foto: FotoAlbum, nome: string): Promise<File> {
  const blob = await (await fetch(foto.url)).blob()
  return new File([blob], nome, { type: blob.type || 'image/jpeg' })
}

// /c/:codigo/f/:foto — a foto grande, com anterior/próxima (botões, teclado e deslize) e as ações.
export function PhotoViewPage() {
  const { codigo = '', foto: fotoId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [carga, setCarga] = useState<Carga>({ tipo: 'carregando' })
  const [pedindoRemocao, setPedindoRemocao] = useState(false)
  const [enviandoPedido, setEnviandoPedido] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const toqueInicial = useRef<number | null>(null)

  useEffect(() => {
    let ativo = true
    lerAlbum(codigo).then((c) => ativo && setCarga(c))
    return () => {
      ativo = false
    }
  }, [codigo])

  const fotos = carga.tipo === 'ok' ? carga.fotos : []
  const indice = fotos.findIndex((f) => f.id === fotoId)
  const foto = indice >= 0 ? fotos[indice] : null
  const anterior = indice > 0 ? fotos[indice - 1] : null
  const proxima = indice >= 0 && indice < fotos.length - 1 ? fotos[indice + 1] : null

  const irPara = useCallback(
    (destino: FotoAlbum | null) => {
      if (!destino) return
      setPedindoRemocao(false)
      setAviso(null)
      navigate(`/c/${codigo}/f/${destino.id}`, { replace: true })
    },
    [codigo, navigate],
  )

  // Volta para o álbum mantendo a rolagem quando veio de lá; senão, abre o álbum.
  const voltar = useCallback(() => {
    if (location.key !== 'default') navigate(-1)
    else navigate(`/c/${codigo}`)
  }, [codigo, location.key, navigate])

  useEffect(() => {
    function teclas(e: KeyboardEvent) {
      if (pedindoRemocao) return
      if (e.key === 'ArrowLeft') irPara(anterior)
      if (e.key === 'ArrowRight') irPara(proxima)
      if (e.key === 'Escape') voltar()
    }
    window.addEventListener('keydown', teclas)
    return () => window.removeEventListener('keydown', teclas)
  }, [anterior, proxima, irPara, voltar, pedindoRemocao])

  async function baixar() {
    if (!foto) return
    const nome = nomeDoArquivo(codigo, foto)
    const url = URL.createObjectURL(await arquivoDa(foto, nome))
    const link = document.createElement('a')
    link.href = url
    link.download = nome
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  async function compartilhar() {
    if (!foto) return
    try {
      const arquivo = await arquivoDa(foto, nomeDoArquivo(codigo, foto))
      if (navigator.canShare?.({ files: [arquivo] })) await navigator.share({ files: [arquivo] })
      else await navigator.share({ url: window.location.href })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // a pessoa fechou o compartilhamento
      setAviso('Não deu para compartilhar daqui. Use Baixar e compartilhe a foto salva.')
    }
  }

  async function pedirRemocao() {
    if (!foto) return
    setEnviandoPedido(true)
    try {
      await api.pedirRemocao(codigo, foto.id)
      setAviso('Pedido enviado ao anfitrião.')
      setPedindoRemocao(false)
    } catch {
      setAviso('Não deu para enviar o pedido. Tente de novo.')
    } finally {
      setEnviandoPedido(false)
    }
  }

  const podeCompartilhar = typeof navigator.share === 'function'

  if (carga.tipo === 'carregando') {
    return <div className="min-h-dvh bg-base" aria-busy="true" />
  }

  if (carga.tipo === 'erro' || !foto) {
    return (
      <div className="flex min-h-dvh flex-col bg-base text-paper">
        <BlocoEstado
          className="flex-1"
          titulo="Foto indisponível"
          texto={carga.tipo === 'erro' ? carga.mensagem : 'Esta foto não está mais no álbum.'}
          acao={<Botao para={`/c/${codigo}`}>Ver o álbum</Botao>}
        />
      </div>
    )
  }

  const descricao = `Foto ${foto.numero}${foto.apelido ? ` de ${foto.apelido}` : ''}`
  const botaoIcone = 'flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-surface disabled:opacity-30'

  return (
    <div className="flex h-dvh flex-col bg-base pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-paper">
      <header className="flex min-h-16 items-center gap-2 px-3">
        <button type="button" onClick={voltar} aria-label="Voltar ao álbum" className={botaoIcone}>
          <Icone nome="voltar" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tabular-nums">
            {String(foto.numero).padStart(3, '0')}
            {foto.apelido && <span className="font-normal text-muted"> · {foto.apelido}</span>}
          </p>
          <p className="truncate text-xs text-muted">{carga.nome}</p>
        </div>
        <span className="pr-2 text-xs text-muted tabular-nums">
          {indice + 1} de {fotos.length}
        </span>
      </header>

      <div
        className="relative flex min-h-0 flex-1 touch-pan-y select-none items-center justify-center px-2"
        onPointerDown={(e) => {
          toqueInicial.current = e.clientX
        }}
        onPointerUp={(e) => {
          if (toqueInicial.current === null) return
          const dx = e.clientX - toqueInicial.current
          toqueInicial.current = null
          if (dx > DESLIZE_MIN_PX) irPara(anterior)
          if (dx < -DESLIZE_MIN_PX) irPara(proxima)
        }}
      >
        <img
          key={foto.id}
          src={foto.url}
          alt={descricao}
          draggable={false}
          className="max-h-full max-w-full rounded-[10px] object-contain outline outline-1 -outline-offset-1 outline-white/10"
        />
        <button type="button" onClick={() => irPara(anterior)} disabled={!anterior} aria-label="Foto anterior" className={`${botaoIcone} absolute left-2 top-1/2 -translate-y-1/2 bg-base/60 backdrop-blur-sm max-sm:hidden`}>
          <Icone nome="anterior" />
        </button>
        <button type="button" onClick={() => irPara(proxima)} disabled={!proxima} aria-label="Próxima foto" className={`${botaoIcone} absolute right-2 top-1/2 -translate-y-1/2 bg-base/60 backdrop-blur-sm max-sm:hidden`}>
          <Icone nome="proxima" />
        </button>
      </div>

      <footer className="px-4 pb-4 pt-3">
        {pedindoRemocao ? (
          <Confirmacao
            className="mx-auto max-w-[440px]"
            pergunta="Pedir para remover esta foto?"
            detalhe="O anfitrião recebe o pedido e decide se apaga."
            rotuloConfirmar="Pedir remoção"
            rotuloCarregando="Enviando..."
            carregando={enviandoPedido}
            onConfirmar={() => void pedirRemocao()}
            onCancelar={() => setPedindoRemocao(false)}
          />
        ) : (
          <div className="mx-auto flex max-w-[440px] flex-col gap-3">
            {aviso && (
              <p role="status" className="text-center text-sm text-muted">
                {aviso}
              </p>
            )}
            <div className="flex gap-2">
              <Botao className="flex-1" onClick={() => void baixar()}>
                <Icone nome="baixar" className="h-5 w-5" />
                Baixar
              </Botao>
              {podeCompartilhar && (
                <Botao variante="secundario" className="flex-1" onClick={() => void compartilhar()}>
                  <Icone nome="compartilhar" className="h-5 w-5" />
                  Compartilhar
                </Botao>
              )}
            </div>
            <div className="flex justify-between">
              <Link to={`/c/${codigo}`} className="flex min-h-11 items-center text-sm text-muted transition hover:text-paper">
                Ver o álbum
              </Link>
              <button type="button" onClick={() => setPedindoRemocao(true)} className="flex min-h-11 items-center text-sm text-muted transition hover:text-paper">
                Pedir remoção
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}
