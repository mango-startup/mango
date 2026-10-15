import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BlocoEstado } from '../components/BlocoEstado'
import { Botao } from '../components/Botao'
import { Icone } from '../components/Icone'
import { MangoLogo } from '../components/MangoLogo'
import { api, type Estado, type PainelEvento } from '../lib/api'
import { situacao } from '../lib/situacao'
import { lerRascunho } from './criar/rascunho'

const ENCERRADOS: Estado[] = ['expirado', 'cancelado']

/** Para onde a ficha leva e o que ela promete. */
function proximaAcao({ evento: e }: PainelEvento): { para: string; rotulo: string } {
  if (e.estado === 'rascunho' || e.estado === 'aguardando_pagamento') return { para: `/eventos/${e.id}/pagamento`, rotulo: 'Pagar' }
  if (e.estado === 'captura_encerrada') return { para: `/eventos/${e.id}`, rotulo: 'Revelar' }
  if (e.estado === 'revelado') return { para: `/eventos/${e.id}`, rotulo: 'Ver o álbum' }
  return { para: `/eventos/${e.id}`, rotulo: 'Abrir' }
}

// /eventos — as fichas dos eventos que este aparelho administra, mais o rascunho da criação.
export function MyEventsPage() {
  const [eventos, setEventos] = useState<PainelEvento[] | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [rascunho] = useState(() => lerRascunho<{ nome: string }>())

  useEffect(() => {
    let ativo = true
    api.meusEventos().then(
      (lista) => ativo && setEventos(lista),
      () => ativo && setFalhou(true),
    )
    return () => {
      ativo = false
    }
  }, [])

  const ativos = eventos?.filter((p) => !ENCERRADOS.includes(p.evento.estado)) ?? []
  const encerrados = eventos?.filter((p) => ENCERRADOS.includes(p.evento.estado)) ?? []
  const vazio = eventos !== null && eventos.length === 0 && !rascunho

  return (
    <div className="min-h-dvh bg-base px-5 pb-12 pt-[env(safe-area-inset-top)] text-paper">
      <header className="mx-auto flex min-h-16 max-w-[560px] items-center justify-between">
        <Link to="/" className="flex min-h-11 items-center gap-2 font-display text-[22px] leading-none">
          <MangoLogo className="h-[21px] w-4" />
          <span className="pb-0.5">mango</span>
        </Link>
        {!vazio && (
          <Botao para="/criar" variante="secundario" className="min-h-11 px-4">
            Nova câmera
          </Botao>
        )}
      </header>

      <main className="mx-auto mt-6 max-w-[560px]">
        <h1 className="font-display text-[44px] leading-none">Meus eventos</h1>
        <p className="mt-3 text-[15px] text-muted">Os eventos que você administra neste aparelho.</p>

        {eventos === null && !falhou && (
          <p role="status" className="py-12 text-[15px] text-muted">
            Carregando...
          </p>
        )}
        {falhou && <p className="py-12 text-[15px] text-danger-ink">Não foi possível carregar seus eventos. Confira sua conexão.</p>}

        {vazio && (
          <BlocoEstado
            className="py-14"
            titulo="Nenhum evento neste aparelho"
            texto="Crie a primeira câmera. Se você criou em outro aparelho, abra o link de anfitrião que guardou."
            acao={
              <div className="flex flex-col items-center gap-2">
                <Botao para="/criar">Criar uma câmera</Botao>
                <Botao para="/entrar" variante="discreto">
                  Tenho um link de anfitrião
                </Botao>
              </div>
            }
          />
        )}

        {(rascunho || ativos.length > 0) && (
          <ul className="mt-8 flex flex-col border-t border-line">
            {rascunho && (
              <li>
                <Ficha para="/criar" nome={rascunho.nome?.trim() || 'Evento sem nome'} situacao="Rascunho neste aparelho" rotulo="Continuar" />
              </li>
            )}
            {ativos.map((p) => {
              const s = situacao(p.evento)
              const acao = proximaAcao(p)
              const contagem = ['captura_aberta', 'captura_encerrada', 'revelado'].includes(p.evento.estado)
                ? `${p.fotos} ${p.fotos === 1 ? 'foto' : 'fotos'} · ${p.convidados} ${p.convidados === 1 ? 'convidado' : 'convidados'}`
                : null
              return (
                <li key={p.evento.id}>
                  <Ficha para={acao.para} nome={p.evento.nome} situacao={s.texto} ativo={s.ativo} contagem={contagem} rotulo={acao.rotulo} />
                </li>
              )
            })}
          </ul>
        )}

        {encerrados.length > 0 && (
          <section className="mt-12">
            <h2 className="text-sm font-semibold text-muted">Encerrados</h2>
            <ul className="mt-3 flex flex-col border-t border-line">
              {encerrados.map((p) => (
                <li key={p.evento.id}>
                  <Ficha para={`/eventos/${p.evento.id}`} nome={p.evento.nome} situacao={situacao(p.evento).texto} rotulo="Abrir" apagada />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

interface FichaProps {
  para: string
  nome: string
  situacao: string
  rotulo: string
  ativo?: boolean
  contagem?: string | null
  apagada?: boolean
}

// Uma linha por evento, como uma ficha de laboratório: nome, situação e a próxima ação.
function Ficha({ para, nome, situacao, rotulo, ativo = false, contagem, apagada = false }: FichaProps) {
  return (
    <Link to={para} className="group flex min-h-20 items-center justify-between gap-4 border-b border-line py-4 transition hover:bg-surface/50">
      <span className="flex min-w-0 flex-col gap-1">
        <span className={`truncate font-display text-[24px] leading-tight ${apagada ? 'text-muted' : ''}`}>{nome}</span>
        <span className="flex items-center gap-2 text-sm text-muted">
          <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${ativo ? 'bg-paper' : 'border border-muted'}`} />
          <span className="truncate">{situacao}</span>
        </span>
        {contagem && <span className="text-sm text-muted tabular-nums">{contagem}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
        {rotulo}
        <Icone nome="proxima" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
