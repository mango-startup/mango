import { useTitulo } from '../lib/useTitulo'
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Botao } from '../components/Botao'
import { CampoCopiavel } from '../components/CampoCopiavel'
import { MangoLogo } from '../components/MangoLogo'
import { ErroApi, api, type Evento } from '../lib/api'
import { quando } from '../lib/datas'
import { useConfigPublica } from '../lib/configPublica'
import { precoExato } from '../lib/formato'
import { usePrecoPublico } from '../lib/precoPublico'
import { calcularPreco } from '../lib/simuladorPreco'
import { EscolhaPessoasFotos } from '../components/EscolhaPessoasFotos'
import { guardarRascunho, lerRascunho } from './criar/rascunho'
import { montarHorarios, type CampoHorario, type CamposHorario, type ModoRevelacao } from './criar/horarios'

interface Formulario extends CamposHorario {
  nome: string
  email: string
  participantes: string
  fotos: number | 'ilimitado'
}

type CampoErro = 'nome' | 'pessoas' | 'email' | CampoHorario | 'geral'

function hojeMais(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formularioInicial(): Formulario {
  const padrao: Formulario = { nome: '', email: '', data: hojeMais(7), inicio: '19:00', fim: '02:00', participantes: '30', fotos: 24, revelacao: 'manha', revelacaoEm: '' }
  return { ...padrao, ...lerRascunho<Formulario>() }
}

/** Erros da api que dizem respeito a um campo específico. */
const CAMPO_DO_ERRO: Record<string, CampoErro> = {
  nome_invalido: 'nome',
  participantes_invalidos: 'pessoas',
  email_invalido: 'email',
  email_obrigatorio: 'email',
  fotos_invalidas: 'pessoas',
  datas_invalidas: 'data',
  fim_no_passado: 'data',
  periodo_invalido: 'fim',
  periodo_longo: 'fim',
  revelacao_invalida: 'revelacaoEm',
  revelacao_fora_do_prazo: 'revelacaoEm',
}

// /criar — uma página só, com padrões prontos. Depois de criar, mostra os links (convidado e anfitrião).
export function CreateEventPage() {
  useTitulo('Nova câmera')
  const [form, setForm] = useState<Formulario>(formularioInicial)
  const [erro, setErro] = useState<{ campo: CampoErro; mensagem: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [criado, setCriado] = useState<{ evento: Evento; linkAnfitriao: string } | null>(null)
  const ids = { nome: useId(), email: useId(), data: useId(), inicio: useId(), fim: useId(), revelacaoEm: useId() }
  const cfg = useConfigPublica()
  const pagamentoDisponivel = cfg.pacotes_pagos_disponiveis
  const precos = usePrecoPublico()

  useEffect(() => {
    if (!criado) guardarRascunho(form)
  }, [form, criado])

  // Preço por participante: o total mostrado é o mesmo que o servidor vai calcular ao criar.
  const pessoas = /^\d+$/.test(form.participantes.trim()) ? Number(form.participantes.trim()) : 0
  const total = pessoas >= 1 ? calcularPreco(pessoas, precos, form.fotos) : null
  const posesPrevia = form.fotos === 'ilimitado' ? precos.tetoIlimitado : form.fotos
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
    const email = form.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setErro({ campo: 'email', mensagem: 'Confira o e-mail: precisa ser parecido com nome@exemplo.com.' })
    if (!email && total !== null && total > 0) return setErro({ campo: 'email', mensagem: 'Informe seu e-mail: é para onde mandamos o link de anfitrião.' })
    if (pessoas < 1 || pessoas > 5000) return setErro({ campo: 'pessoas', mensagem: 'Informe de 1 a 5000 pessoas.' })
    setEnviando(true)
    setErro(null)
    try {
      const evento = await api.criarEvento({
        nome: form.nome,
        participantes: pessoas,
        fotos: form.fotos,
        ...(email ? { email } : {}),
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

        <EscolhaPessoasFotos params={precos} participantes={form.participantes} fotos={form.fotos} total={total} erro={erro?.campo === 'pessoas' ? erro.mensagem : undefined} onParticipantes={(v) => mudar('participantes', v)} onFotos={(v) => mudar('fotos', v)} />

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


        <div className="flex flex-col gap-2">
          <label htmlFor={ids.email} className="text-sm font-semibold">
            Seu e-mail {total === 0 && <span className="font-normal text-muted">(opcional)</span>}
          </label>
          <input id={ids.email} type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => mudar('email', e.target.value)} placeholder="voce@exemplo.com" className={`${campoTexto} placeholder:text-muted/60`} />
          <p className="text-sm text-muted">Mandamos o link de anfitrião para você não perder o acesso ao evento. Não usamos para propaganda.</p>
          {erroDe('email')}
        </div>

        <PreviaConvite nome={form.nome} poses={posesPrevia} revelacao={'campo' in horarios ? null : horarios.revelacao} />

        <div className="flex flex-col gap-3">
          {erroDe('geral')}
          {!cfg.criacao_aberta && (
            <p role="status" className="rounded-[12px] border border-line bg-surface px-4 py-3 text-sm">
              A criação de eventos está pausada por um instante. Tente de novo em breve.
            </p>
          )}
          <Botao type="submit" disabled={enviando || total === null || (total > 0 && !pagamentoDisponivel) || !cfg.criacao_aberta} className="w-full">
            <span key={enviando ? 'envio' : total} className="anim-troca">
              {enviando ? 'Criando...' : total ? `Continuar · ${precoExato(total)}` : 'Criar a câmera'}
            </span>
          </Botao>
          {total !== null && total > 0 && !pagamentoDisponivel && <p className="text-center text-sm text-muted">Pagamento em breve. Por enquanto dá para testar com até {precos.gratis} pessoas e {precos.fotosTeste} fotos cada.</p>}
          {total !== null && total > 0 && pagamentoDisponivel && <p className="text-center text-sm text-muted">Você paga na próxima etapa. O link só funciona depois do pagamento.</p>}
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
