import { useTitulo } from '../lib/useTitulo'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BlocoEstado } from '../components/BlocoEstado'
import { Botao } from '../components/Botao'
import { CampoCopiavel } from '../components/CampoCopiavel'
import { Confirmacao } from '../components/Confirmacao'
import { Icone } from '../components/Icone'
import { QrConvite } from '../components/QrConvite'
import { MangoLogo } from '../components/MangoLogo'
import { ErroApi, api, type Estado, type PainelEvento } from '../lib/api'
import { quando } from '../lib/datas'
import { situacao } from '../lib/situacao'

type Acao = 'encerrar' | 'revelar' | 'trocarLink' | 'cancelar' | 'excluir'

const ATUALIZA_MS = 30_000
const COM_LINK: Estado[] = ['pronto', 'captura_aberta', 'captura_encerrada', 'revelado']
const COM_FOTOS: Estado[] = ['captura_aberta', 'captura_encerrada', 'revelado']

// /eventos/:id — a ficha do evento: em que pé está, a próxima ação e os links.
export function EventDashboardPage() {
  useTitulo('Painel do evento')
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [painel, setPainel] = useState<PainelEvento | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const [linkAnfitriao, setLinkAnfitriao] = useState('')
  const [confirmando, setConfirmando] = useState<Acao | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const carregar = useCallback(
    () =>
      api.painel(id).then(setPainel, (e: unknown) => {
        setFalha(e instanceof ErroApi && e.erro === 'nao_autorizado' ? 'Este aparelho não tem acesso a este evento.' : 'Não deu para abrir o evento.')
      }),
    [id],
  )

  useEffect(() => {
    let ativo = true
    api.painel(id).then(
      (p) => ativo && setPainel(p),
      (e: unknown) =>
        ativo && setFalha(e instanceof ErroApi && e.erro === 'nao_autorizado' ? 'Este aparelho não tem acesso a este evento.' : 'Não deu para abrir o evento.'),
    )
    api.linkDoAnfitriao(id).then((l) => ativo && setLinkAnfitriao(l), () => {})
    return () => {
      ativo = false
    }
  }, [id])

  // Com a câmera aberta, a contagem de convidados e fotos se atualiza sozinha
  const estado = painel?.evento.estado
  useEffect(() => {
    if (estado !== 'captura_aberta') return
    const timer = setInterval(() => void carregar(), ATUALIZA_MS)
    return () => clearInterval(timer)
  }, [estado, carregar])

  async function executar(acao: Acao) {
    setOcupado(true)
    setAviso(null)
    try {
      if (acao === 'encerrar') await api.encerrar(id)
      if (acao === 'revelar') await api.revelar(id)
      if (acao === 'cancelar') await api.cancelar(id)
      if (acao === 'trocarLink') {
        await api.trocarCodigo(id)
        setAviso('Link trocado. Mande o novo para os convidados.')
      }
      if (acao === 'excluir') {
        await api.excluir(id)
        navigate('/eventos', { replace: true })
        return
      }
      setConfirmando(null)
      await carregar()
    } catch (e) {
      setAviso(e instanceof ErroApi ? e.message : 'Não deu certo. Confira sua conexão e tente de novo.')
      await carregar()
    } finally {
      setOcupado(false)
    }
  }

  async function alternarPrivado(privado: boolean) {
    try {
      await api.editarEvento(id, { album_privado: privado })
      await carregar()
    } catch (e) {
      setAviso(e instanceof ErroApi ? e.message : 'Não deu para mudar o álbum agora.')
    }
  }

  async function baixarZip() {
    if (!painel) return
    try {
      const zip = await api.baixarAlbum(id)
      const url = URL.createObjectURL(zip)
      const link = document.createElement('a')
      link.href = url
      link.download = `mango-${painel.evento.codigo.toLowerCase()}.zip`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      setAviso(e instanceof ErroApi ? e.message : 'Não deu para baixar o álbum agora.')
    }
  }

  if (falha) {
    return (
      <Casca>
        <BlocoEstado
          className="py-16"
          titulo="Evento indisponível"
          texto={`${falha} Abra o link de anfitrião que você guardou ao criar o evento.`}
          acao={<Botao para="/eventos">Meus eventos</Botao>}
        />
      </Casca>
    )
  }

  if (!painel) {
    return (
      <Casca>
        <p role="status" className="py-16 text-center text-[15px] text-muted">
          Abrindo o evento...
        </p>
      </Casca>
    )
  }

  const { evento: e, convidados, fotos } = painel
  const { texto, ativo } = situacao(e)
  const linkConvidado = `${window.location.origin}/c/${e.codigo}`
  const podeCancelar = e.estado === 'pronto' && fotos === 0
  const confirmacao = (acao: Acao, props: Omit<Parameters<typeof Confirmacao>[0], 'onConfirmar' | 'onCancelar' | 'carregando'>) =>
    confirmando === acao ? (
      <Confirmacao {...props} carregando={ocupado} onConfirmar={() => void executar(acao)} onCancelar={() => setConfirmando(null)} />
    ) : null

  return (
    <Casca>
      <h1 className="font-display text-[44px] leading-[1.02] [text-wrap:balance]">{e.nome}</h1>
      <p className="mt-3 flex items-center gap-2 text-[15px]">
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${ativo ? 'bg-paper' : 'border border-muted'}`} />
        <span className={ativo ? '' : 'text-muted'}>{texto}</span>
      </p>

      {COM_FOTOS.includes(e.estado) && (
        <dl className="mt-8 grid grid-cols-2 border-y border-line">
          <div className="py-4">
            <dt className="text-sm text-muted">Convidados</dt>
            <dd className="mt-1 font-display text-[32px] leading-none tabular-nums">
              {convidados}
              <span className="text-[18px] text-muted"> de {e.limite_convidados}</span>
            </dd>
          </div>
          <div className="border-l border-line py-4 pl-4">
            <dt className="text-sm text-muted">Fotos</dt>
            <dd className="mt-1 font-display text-[32px] leading-none tabular-nums">{fotos}</dd>
          </div>
        </dl>
      )}

      {aviso && (
        <p role="status" className="mt-6 text-sm text-muted">
          {aviso}
        </p>
      )}

      {/* Próxima ação: uma só, conforme o estado */}
      <section className="mt-8 flex flex-col gap-3" aria-label="Próxima ação">
        {(e.estado === 'rascunho' || e.estado === 'aguardando_pagamento') && <Botao para={`/eventos/${e.id}/pagamento`}>Ir para o pagamento</Botao>}
        {e.estado === 'captura_aberta' &&
          (confirmacao('encerrar', {
            pergunta: 'Encerrar a câmera agora?',
            detalhe: 'Ninguém mais tira fotos. Fotos que ainda estão subindo entram no álbum.',
            rotuloConfirmar: 'Encerrar a câmera',
            rotuloCarregando: 'Encerrando...',
          }) ?? (
            <Botao variante="secundario" onClick={() => setConfirmando('encerrar')}>
              Encerrar a câmera agora
            </Botao>
          ))}
        {e.estado === 'captura_encerrada' &&
          (confirmacao('revelar', {
            pergunta: 'Revelar o álbum agora?',
            detalhe: 'Todos com o link passam a ver as fotos.',
            rotuloConfirmar: 'Revelar agora',
            rotuloCarregando: 'Revelando...',
          }) ?? <Botao onClick={() => setConfirmando('revelar')}>Revelar agora</Botao>)}
        {e.estado === 'revelado' && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Botao para={`/c/${e.codigo}`} className="flex-1">
              Ver o álbum
            </Botao>
            <Botao variante="secundario" className="flex-1" onClick={() => void baixarZip()}>
              <Icone nome="baixar" className="h-5 w-5" />
              Baixar tudo
            </Botao>
          </div>
        )}
      </section>

      {COM_LINK.includes(e.estado) && (
        <section className="mt-10">
          <CampoCopiavel rotulo="Link para os convidados" valor={linkConvidado} ajuda="Mande no grupo da festa ou imprima o QR abaixo." />
          <div className="mt-6">
            <QrConvite valor={linkConvidado} arquivo={`mango-qr-${e.codigo.toLowerCase()}`} />
          </div>
        </section>
      )}

      {/* Datas */}
      <dl className="mt-10 flex flex-col text-[15px]">
        {[
          ['Câmera abre', e.captura_inicio],
          ['Câmera fecha', e.captura_fim],
          ['Revelação', e.revelacao_manual ? null : e.revelacao_em],
          ['Álbum até', e.expira_em],
        ]
          .filter(([, valor]) => valor)
          .map(([rotulo, valor]) => (
            <div key={rotulo} className="flex justify-between gap-4 border-b border-line py-3">
              <dt className="text-muted">{rotulo}</dt>
              <dd className="text-right">{quando(valor!)}</dd>
            </div>
          ))}
        {e.revelacao_manual && e.estado !== 'revelado' && (
          <div className="flex justify-between gap-4 border-b border-line py-3">
            <dt className="text-muted">Revelação</dt>
            <dd className="text-right">quando você decidir</dd>
          </div>
        )}
      </dl>

      {/* Ajustes e ações menos frequentes */}
      <section className="mt-10 flex flex-col" aria-label="Mais opções">
        {COM_FOTOS.includes(e.estado) && (
          <Linha para={`/eventos/${e.id}/moderacao`} titulo="Moderar fotos" texto="Ver e apagar fotos, e responder pedidos de remoção." />
        )}
        {e.estado !== 'cancelado' && e.estado !== 'expirado' && (
          <Interruptor
            titulo="Álbum só para mim"
            texto="Os convidados não veem o álbum, nem depois da revelação."
            ligado={e.album_privado}
            onMudar={(v) => void alternarPrivado(v)}
          />
        )}
        {COM_LINK.includes(e.estado) &&
          (confirmacao('trocarLink', {
            pergunta: 'Trocar o link dos convidados?',
            detalhe: 'O link antigo para de funcionar. Use se ele circulou para quem não devia.',
            rotuloConfirmar: 'Trocar o link',
            rotuloCarregando: 'Trocando...',
          }) ?? <Linha onClick={() => setConfirmando('trocarLink')} titulo="Trocar o link dos convidados" texto="O link antigo para de funcionar." />)}
        {podeCancelar &&
          (confirmacao('cancelar', {
            pergunta: 'Cancelar o evento?',
            detalhe: 'A câmera não abre mais. Dá para cancelar só enquanto não houver nenhuma foto.',
            rotuloConfirmar: 'Cancelar o evento',
            rotuloCarregando: 'Cancelando...',
            destrutiva: true,
          }) ?? <Linha onClick={() => setConfirmando('cancelar')} titulo="Cancelar o evento" texto="Só enquanto não houver nenhuma foto." />)}
        {confirmacao('excluir', {
          pergunta: 'Excluir o evento e todas as fotos?',
          detalhe: 'O evento some na hora e as fotos são apagadas em até 30 dias. Não dá para desfazer.',
          rotuloConfirmar: 'Excluir para sempre',
          rotuloCarregando: 'Excluindo...',
          destrutiva: true,
          digitarParaConfirmar: e.nome,
        }) ?? <Linha onClick={() => setConfirmando('excluir')} titulo="Excluir o evento" texto="Apaga o evento e as fotos." perigo />}
      </section>

      {linkAnfitriao && (
        <section className="mt-10 border-t border-line pt-6">
          <CampoCopiavel rotulo="Seu link de anfitrião" valor={linkAnfitriao} ajuda="Abre este painel em outro aparelho. Não mande para os convidados." />
        </section>
      )}
    </Casca>
  )
}

function Casca({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-base px-5 pb-12 pt-[env(safe-area-inset-top)] text-paper">
      <header className="mx-auto flex min-h-16 max-w-[560px] items-center justify-between">
        <Link to="/eventos" className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-[15px] font-semibold text-muted transition hover:text-paper">
          <Icone nome="voltar" className="h-5 w-5" />
          Meus eventos
        </Link>
        <Link to="/" aria-label="Mango, página inicial" className="flex min-h-11 items-center">
          <MangoLogo className="h-[21px] w-4" />
        </Link>
      </header>
      <main className="mx-auto mt-6 max-w-[560px]">{children}</main>
    </div>
  )
}

interface LinhaProps {
  titulo: string
  texto: string
  para?: string
  onClick?: () => void
  perigo?: boolean
}

function Linha({ titulo, texto, para, onClick, perigo = false }: LinhaProps) {
  const conteudo = (
    <>
      <span className="flex flex-col gap-0.5 text-left">
        <span className={`text-[15px] font-semibold ${perigo ? 'text-danger-ink' : ''}`}>{titulo}</span>
        <span className="text-sm text-muted">{texto}</span>
      </span>
      <Icone nome="proxima" className="h-5 w-5 shrink-0 text-muted" />
    </>
  )
  const classes = 'flex min-h-16 w-full items-center justify-between gap-4 border-b border-line py-3 transition hover:bg-surface/50'
  if (para) {
    return (
      <Link to={para} className={classes}>
        {conteudo}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {conteudo}
    </button>
  )
}

function Interruptor({ titulo, texto, ligado, onMudar }: { titulo: string; texto: string; ligado: boolean; onMudar: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onMudar(!ligado)}
      className="flex min-h-16 w-full items-center justify-between gap-4 border-b border-line py-3 text-left"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{titulo}</span>
        <span className="text-sm text-muted">{texto}</span>
      </span>
      <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${ligado ? 'bg-paper' : 'bg-line'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full transition-transform ${ligado ? 'translate-x-6 bg-base' : 'translate-x-1 bg-paper'}`} />
      </span>
    </button>
  )
}
