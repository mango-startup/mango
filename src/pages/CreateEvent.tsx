import { useTitulo } from '../lib/useTitulo'
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Botao } from '../components/Botao'
import { CampoCopiavel } from '../components/CampoCopiavel'
import { MangoLogo } from '../components/MangoLogo'
import { ErroApi, api, type DefinicaoPacote, type Evento, type Pacote } from '../lib/api'
import { quando } from '../lib/datas'
import { useConfigPublica } from '../lib/configPublica'
import { precoEmReais } from '../lib/formato'
import { guardarRascunho, lerRascunho } from './criar/rascunho'
import { montarHorarios, type CampoHorario, type CamposHorario, type ModoRevelacao } from './criar/horarios'

interface Formulario extends CamposHorario {
  nome: string
  poses: number
  pacote: Pacote
}

type CampoErro = 'nome' | 'poses' | 'pacote' | CampoHorario | 'geral'

function hojeMais(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formularioInicial(pacote: Pacote | null): Formulario {
  const padrao: Formulario = { nome: '', data: hojeMais(7), inicio: '19:00', fim: '02:00', poses: 24, pacote: 'teste', revelacao: 'manha', revelacaoEm: '' }
  // O pacote e as poses efetivos são conferidos na tela contra os pacotes e a configuração do servidor.
  return { ...padrao, ...lerRascunho<Formulario>(), ...(pacote ? { pacote } : {}) }
}

/** Erros da api que dizem respeito a um campo específico. */
const CAMPO_DO_ERRO: Record<string, CampoErro> = {
  nome_invalido: 'nome',
  poses_invalidas: 'poses',
  pacote_invalido: 'pacote',
  datas_invalidas: 'data',
  fim_no_passado: 'data',
  periodo_invalido: 'fim',
  periodo_longo: 'fim',
  revelacao_invalida: 'revelacaoEm',
  revelacao_fora_do_prazo: 'revelacaoEm',
}

// Só o formato: se o pacote existe e está à venda, quem decide é a lista que o servidor manda.
const ehPacote = (v: string | null): v is Pacote => v !== null && /^[a-z][a-z0-9_]{1,29}$/.test(v)

// /criar — uma página só, com padrões prontos. Depois de criar, mostra os links (convidado e anfitrião).
export function CreateEventPage() {
  useTitulo('Nova câmera')
  const [params] = useSearchParams()
  const pacoteDaUrl = params.get('pacote')
  const [form, setForm] = useState<Formulario>(() => formularioInicial(ehPacote(pacoteDaUrl) ? pacoteDaUrl : null))
  const [pacotes, setPacotes] = useState<DefinicaoPacote[]>([])
  const [erro, setErro] = useState<{ campo: CampoErro; mensagem: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [criado, setCriado] = useState<{ evento: Evento; linkAnfitriao: string } | null>(null)
  const ids = { nome: useId(), data: useId(), inicio: useId(), fim: useId(), revelacaoEm: useId() }
  const cfg = useConfigPublica()
  const pagamentoDisponivel = cfg.pacotes_pagos_disponiveis

  useEffect(() => {
    let ativo = true
    api.pacotes().then((p) => ativo && setPacotes(p))
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (!criado) guardarRascunho(form)
  }, [form, criado])

  // Pacote que vale: o escolhido, se existe e se pode ser comprado agora; senão o teste grátis.
  const pacote = pacotes.find((p) => p.id === form.pacote && (p.gratis || pagamentoDisponivel)) ?? pacotes.find((p) => p.id === 'teste')
  const maiorPose = Math.max(...cfg.poses_validas)
  const posesMax = pacote?.poses_max ?? maiorPose
  // Poses que valem: a escolhida, se o pacote deixa; senão a sugestão da configuração (ou a maior que cabe).
  const cabem = cfg.poses_validas.filter((n) => n <= posesMax)
  const poses = cabem.includes(form.poses) ? form.poses : cabem.includes(cfg.poses_padrao) ? cfg.poses_padrao : (cabem.at(-1) ?? cfg.poses_validas[0])
  const horarios = useMemo(() => montarHorarios(form, new Date(), { revelacaoMaxDias: cfg.revelacao_max_dias }), [form, cfg.revelacao_max_dias])

  function mudar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setErro(null)
    setForm((f) => {
      const novo = { ...f, [campo]: valor }
      return novo
    })
  }

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) return setErro({ campo: 'nome', mensagem: 'Dê um nome para o evento.' })
    if ('campo' in horarios) return setErro(horarios)
    setEnviando(true)
    setErro(null)
    try {
      const evento = await api.criarEvento({
        nome: form.nome,
        pacote: pacote?.id ?? form.pacote,
        poses_por_convidado: poses,
        captura_inicio: horarios.captura_inicio,
        captura_fim: horarios.captura_fim,
        revelacao_em: horarios.revelacao_em,
        revelacao_manual: horarios.revelacao_manual,
      })
      guardarRascunho(null)
      setCriado({ evento, linkAnfitriao: await api.linkDoAnfitriao(evento.id) })
      window.scrollTo(0, 0)
    } catch (err) {
      if (err instanceof ErroApi) setErro({ campo: CAMPO_DO_ERRO[err.erro] ?? 'geral', mensagem: err.message })
      else setErro({ campo: 'geral', mensagem: 'Não deu para criar a câmera. Confira sua conexão e tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  if (criado) return <Criado evento={criado.evento} linkAnfitriao={criado.linkAnfitriao} />

  const erroDe = (campo: CampoErro) =>
    erro?.campo === campo ? (
      <p role="alert" className="text-sm text-danger-ink">
        {erro.mensagem}
      </p>
    ) : null
  const campoTexto = 'min-h-12 w-full rounded-[14px] border border-line bg-surface px-4 text-base text-paper'

  return (
    <Pagina>
      <h1 className="font-display text-[44px] leading-none">Nova câmera</h1>
      <p className="mt-3 text-[15px] text-muted">Leva um minuto. Dá para ajustar os horários depois.</p>

      <form onSubmit={criar} noValidate className="mt-10 flex flex-col gap-9">
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.nome} className="text-sm font-semibold">
            Nome da festa
          </label>
          <input id={ids.nome} value={form.nome} onChange={(e) => mudar('nome', e.target.value)} maxLength={cfg.nome_evento_max} placeholder="Casamento da Ana e do Léo" className={`${campoTexto} placeholder:text-muted/60`} />
          {erroDe('nome')}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-semibold">Quando a câmera fica aberta</legend>
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
            <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted" htmlFor={ids.data}>
              Data
              <input id={ids.data} type="date" value={form.data} onChange={(e) => mudar('data', e.target.value)} className={campoTexto} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted" htmlFor={ids.inicio}>
              Abre
              <input id={ids.inicio} type="time" value={form.inicio} onChange={(e) => mudar('inicio', e.target.value)} className={campoTexto} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted" htmlFor={ids.fim}>
              Fecha
              <input id={ids.fim} type="time" value={form.fim} onChange={(e) => mudar('fim', e.target.value)} className={campoTexto} />
            </label>
          </div>
          {!('campo' in horarios) && horarios.fimNoDiaSeguinte && <p className="text-sm text-muted">Fecha no dia seguinte, às {form.fim}.</p>}
          {erroDe('data')}
          {erroDe('fim')}
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Fotos por convidado</legend>
          <Opcoes>
            {cfg.poses_validas.map((n) => (
              <Opcao key={n} nome="poses" marcada={poses === n} desabilitada={n > posesMax} onEscolher={() => mudar('poses', n)}>
                <span className="font-display text-[28px] leading-none tabular-nums">{n}</span>
              </Opcao>
            ))}
          </Opcoes>
          {posesMax < maiorPose && (
            <p className="mt-2 text-sm text-muted">{pacote?.gratis ? 'O teste grátis' : `O pacote ${pacote?.nome ?? ''}`.trim()} vai até {posesMax} fotos.</p>
          )}
          {erroDe('poses')}
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Revelação</legend>
          <div className="flex flex-col gap-2">
            {(
              [
                ['manha', !('campo' in horarios) && horarios.revelacao ? `Na manhã seguinte (${quando(horarios.revelacao.toISOString())})` : 'Na manhã seguinte, às 10h'],
                ['escolher', 'Escolher dia e hora'],
                ['manual', 'Quando eu decidir'],
              ] as [ModoRevelacao, string][]
            ).map(([modo, rotulo]) => (
              <Opcao key={modo} nome="revelacao" marcada={form.revelacao === modo} onEscolher={() => mudar('revelacao', modo)} alinhar="esquerda">
                {rotulo}
              </Opcao>
            ))}
          </div>
          {form.revelacao === 'escolher' && (
            <label htmlFor={ids.revelacaoEm} className="anim-in mt-3 flex flex-col gap-1.5 text-xs text-muted">
              Dia e hora da revelação
              <input id={ids.revelacaoEm} type="datetime-local" value={form.revelacaoEm} onChange={(e) => mudar('revelacaoEm', e.target.value)} className={campoTexto} />
            </label>
          )}
          {erroDe('revelacaoEm')}
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Convidados</legend>
          <div className="grid grid-cols-2 gap-2">
            {pacotes.map((p) => (
              <Opcao key={p.id} nome="pacote" marcada={pacote?.id === p.id} desabilitada={!p.gratis && !pagamentoDisponivel} onEscolher={() => mudar('pacote', p.id)} alinhar="esquerda">
                <span className="flex flex-col gap-1 py-1">
                  <span className="font-display text-[26px] leading-none tabular-nums">até {p.convidados}</span>
                  <span className="text-sm text-muted">{p.gratis ? 'Grátis' : pagamentoDisponivel ? precoEmReais(p.preco_centavos) : 'Em breve'}</span>
                </span>
              </Opcao>
            ))}
          </div>
          <p className="mt-2 text-sm">
            <Link to="/precos" className="text-muted underline underline-offset-2 hover:text-paper">
              O que cada pacote inclui
            </Link>
          </p>
          {erroDe('pacote')}
        </fieldset>

        <PreviaConvite nome={form.nome} poses={poses} revelacao={'campo' in horarios ? null : horarios.revelacao} />

        <div className="flex flex-col gap-3">
          {erroDe('geral')}
          {!cfg.criacao_aberta && (
            <p role="status" className="rounded-[12px] border border-line bg-surface px-4 py-3 text-sm">
              A criação de eventos está pausada por um instante. Tente de novo em breve.
            </p>
          )}
          <Botao type="submit" disabled={enviando || pacotes.length === 0 || !cfg.criacao_aberta} className="w-full">
            <span key={enviando ? 'envio' : pacote?.id} className="anim-troca">
              {enviando ? 'Criando...' : pacote && !pacote.gratis ? `Continuar · ${precoEmReais(pacote.preco_centavos)}` : 'Criar a câmera'}
            </span>
          </Botao>
          {pacote && !pacote.gratis && <p className="text-center text-sm text-muted">Você paga na próxima etapa. O link só funciona depois do pagamento.</p>}
        </div>
      </form>
    </Pagina>
  )
}

function Pagina({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-base px-5 pb-12 pt-[env(safe-area-inset-top)] text-paper">
      <header className="mx-auto flex min-h-16 max-w-[520px] items-center">
        <Link to="/" className="flex min-h-11 items-center gap-2 font-display text-[22px] leading-none">
          <MangoLogo className="h-[21px] w-4" />
          <span className="pb-0.5">mango</span>
        </Link>
      </header>
      <main className="mx-auto mt-6 max-w-[520px]">{children}</main>
    </div>
  )
}

function Opcoes({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>
}

interface OpcaoProps {
  nome: string
  marcada: boolean
  desabilitada?: boolean
  alinhar?: 'centro' | 'esquerda'
  onEscolher: () => void
  children: ReactNode
}

// Rádio nativo escondido dentro de um cartão: mantém teclado (setas) e leitor de tela.
function Opcao({ nome, marcada, desabilitada = false, alinhar = 'centro', onEscolher, children }: OpcaoProps) {
  return (
    <label
      className={`flex min-h-14 cursor-pointer items-center rounded-[14px] border px-4 text-[15px] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-paper ${
        alinhar === 'centro' ? 'justify-center' : ''
      } ${marcada ? 'border-paper bg-surface' : 'border-line hover:border-muted'} ${desabilitada ? 'pointer-events-none opacity-35' : ''}`}
    >
      <input type="radio" name={nome} checked={marcada} disabled={desabilitada} onChange={onEscolher} className="sr-only" />
      {children}
    </label>
  )
}

// Como o convidado vai ver o convite (mesma linguagem da tela de boas-vindas).
function PreviaConvite({ nome, poses, revelacao }: { nome: string; poses: number; revelacao: Date | null }) {
  return (
    <section aria-label="Prévia do convite" className="sobre-creme rounded-[20px] bg-paper p-5 text-base">
      <p className="text-xs font-semibold opacity-60">Prévia do convite</p>
      <p className="mt-3 font-display text-[30px] leading-[1.05] [text-wrap:balance]">{nome.trim() || 'Nome da festa'}</p>
      <div className="mt-4 flex items-center gap-4 border-t border-base/15 pt-4">
        <span className="flex flex-col items-center leading-none">
          <span key={poses} className="anim-troca font-display text-[40px] tabular-nums">
            {poses}
          </span>
          <span className="mt-1 text-xs opacity-60">fotos</span>
        </span>
        <p key={revelacao?.getTime() ?? 'manual'} className="anim-troca text-sm leading-snug">
          Ninguém vê as fotos até a revelação.
          <br />
          {revelacao ? `Revelação ${quando(revelacao.toISOString())}.` : 'Revelação quando o anfitrião decidir.'}
        </p>
      </div>
    </section>
  )
}

// Depois de criar: o link do convidado e o link secreto do anfitrião (sem ele, não há como voltar em outro aparelho).
function Criado({ evento, linkAnfitriao }: { evento: Evento; linkAnfitriao: string }) {
  const pago = evento.estado === 'aguardando_pagamento'
  const linkConvidado = `${window.location.origin}/c/${evento.codigo}`
  return (
    <Pagina>
      <h1 className="font-display text-[44px] leading-none [text-wrap:balance]">{pago ? 'Falta só o pagamento' : 'Sua câmera está pronta'}</h1>
      <p className="mt-3 text-[15px] text-muted">{evento.nome}</p>

      <div className="mt-10 flex flex-col gap-8">
        <section className="rounded-[20px] border border-paper p-5">
          <h2 className="font-display text-[26px] leading-tight">Guarde o seu link de anfitrião</h2>
          <p className="mt-2 text-[15px] leading-normal text-muted">
            É com ele que você volta para administrar o evento em qualquer aparelho. Quem tiver esse link controla o evento: não mande para os convidados.
          </p>
          <div className="mt-5">
            <CampoCopiavel rotulo="Link de anfitrião" valor={linkAnfitriao} ajuda="Salve nas suas notas ou mande para você mesmo." />
          </div>
        </section>

        {pago ? (
          <p className="text-[15px] text-muted">Depois do pagamento, o link para os convidados aparece no painel do evento.</p>
        ) : (
          <CampoCopiavel rotulo="Link para os convidados" valor={linkConvidado} ajuda="Mande no grupo ou imprima o QR que fica no painel." />
        )}

        <Botao para={pago ? `/eventos/${evento.id}/pagamento` : `/eventos/${evento.id}`} className="w-full">
          {pago ? 'Ir para o pagamento' : 'Ir para o painel'}
        </Botao>
      </div>
    </Pagina>
  )
}
