import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MangoLogo } from '../components/MangoLogo'
import { api, type DefinicaoPacote } from '../lib/api'
import { useConfigPublica } from '../lib/configPublica'
import { usePrecoPublico } from '../lib/precoPublico'
import { calcularPreco } from '../lib/simuladorPreco'
import { precoEmReais, precoExato } from '../lib/formato'
import { useTitulo } from '../lib/useTitulo'

// Fotos de exemplo do Pexels, só para a landing do protótipo
const STRIP_PHOTOS = [6224713, 6174129, 3171742]
const photoUrl = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=500`

const STEPS = [
  { title: 'Crie a câmera', text: 'Nome, data e quantas fotos cada convidado leva.' },
  { title: 'Compartilhe o link', text: 'Ninguém instala nada. Abriu, fotografou.' },
  { title: 'Revele', text: 'Quando você decidir, o rolo vira álbum. Todo mundo vê junto.' },
]

// Regras do MVP (plano, seção 3); se mudarem, atualizar aqui.
const PERGUNTAS: { pergunta: string; resposta: string; link?: { to: string; texto: string } }[] = [
  {
    pergunta: 'Precisa instalar algum app?',
    resposta: 'Não. O convidado abre o link ou lê o QR na mesa e já fotografa pelo navegador do celular.',
  },
  {
    pergunta: 'Quantas fotos cada convidado tira?',
    resposta: 'Você escolhe ao criar a câmera: 12, 24 ou 36 fotos, como um rolo de verdade. No teste grátis são 12. Não dá para apagar e tirar de novo.',
    link: { to: '/precos', texto: 'Ver os pacotes' },
  },
  {
    pergunta: 'Quando as fotos aparecem?',
    resposta: 'Na revelação, no horário que você escolher (o padrão é a manhã seguinte) ou quando você decidir. Até lá, os convidados não veem nada.',
  },
  {
    pergunta: 'Por quanto tempo o álbum fica no ar?',
    resposta: 'Por 12 meses depois da revelação nos pacotes pagos e 30 dias no teste grátis. Você pode baixar todas as fotos antes disso.',
  },
  {
    pergunta: 'Quem consegue ver o álbum?',
    resposta: 'Quem tem o link do evento. Você pode deixar o álbum visível só para você ou trocar o link se ele circular demais.',
  },
  {
    pergunta: 'E se eu perder o link de anfitrião?',
    resposta: 'Ele fica salvo no aparelho em que você criou o evento: abra Meus eventos por lá e copie o link no painel. Sem esse link, não dá para administrar o evento em outro aparelho.',
    link: { to: '/ajuda', texto: 'Ver a ajuda' },
  },
  {
    pergunta: 'E se o link do álbum vazar?',
    resposta: 'No painel do evento, use "Trocar o link dos convidados". O link antigo para de funcionar e você manda o novo para quem deve receber.',
    link: { to: '/privacidade', texto: 'Ler sobre privacidade' },
  },
  {
    pergunta: 'Dá para remover uma foto do álbum?',
    resposta: 'Sim. O anfitrião apaga qualquer foto em Moderar fotos, no painel do evento, e quem aparece numa foto pode tocar em "Pedir remoção".',
    link: { to: '/privacidade', texto: 'Ler sobre privacidade' },
  },
  {
    pergunta: 'E as fotos de crianças e a localização?',
    resposta: 'As fotos saem sem localização (GPS) nem outros dados da câmera. Festas costumam ter crianças: o anfitrião é responsável por quem recebe o link, e pais e responsáveis podem pedir a remoção.',
    link: { to: '/privacidade', texto: 'Ler sobre privacidade' },
  },
]

// Marca o elemento com .in quando ele entra na tela (revelação ao rolar)
function useReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('in')
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return ref
}

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ '--d': `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  )
}

export function LandingPage() {
  useTitulo()
  const ctaHero = useRef<HTMLDivElement>(null)
  const ctaFinal = useRef<HTMLElement>(null)
  const mostrarCtaFixo = useCtaFixo(ctaHero, ctaFinal)
  return (
    <div className="min-h-svh overflow-x-clip bg-base text-paper">
      <div className="mx-auto max-w-[520px] lg:max-w-[1360px] lg:px-10">
        <div className="lg:mt-8 lg:grid lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1fr_1fr] lg:items-stretch lg:gap-16">
        <section className="sobre-creme rounded-b-[32px] bg-paper pb-8 text-base lg:flex lg:flex-col lg:rounded-[40px] lg:pb-16">
          <header className="anim-up flex items-center justify-between px-6 pt-6 lg:px-14 lg:pt-12">
            <span className="flex items-center gap-2 font-display text-[26px] leading-none">
              <MangoLogo className="h-[26px] w-5" />
              <span className="pb-1">mango</span>
            </span>
            <nav className="flex items-center gap-5 text-sm font-semibold">
              <a href="#como-funciona" className="flex min-h-11 items-center">
                <span className="border-b border-current pb-px">Como funciona</span>
              </a>
              <Link to="/precos" className="flex min-h-11 items-center">
                <span className="border-b border-current pb-px">Preços</span>
              </Link>
            </nav>
          </header>

          <h1 style={{ '--d': '80ms' } as React.CSSProperties} className="anim-up mt-14 px-6 font-display text-[48px] leading-none sm:text-[54px] lg:mt-auto lg:px-14 lg:text-[88px]">
            Todo mundo
            <br />
            fotografa.
            <br />
            Ninguém vê.
          </h1>
          <p style={{ '--d': '160ms' } as React.CSSProperties} className="anim-up mt-5 max-w-[350px] px-6 text-[17px] leading-normal opacity-90 lg:mt-10 lg:max-w-[520px] lg:px-14 lg:text-[22px]">
            Uma câmera descartável para a sua festa. Cada convidado leva um rolo de 12, 24 ou 36
            fotos. Elas só aparecem quando você revelar.
          </p>
          <div ref={ctaHero} style={{ '--d': '240ms' } as React.CSSProperties} className="anim-up mt-6 px-6 lg:mt-12 lg:px-14">
            <Link
              to="/criar"
              className="btn-shimmer flex h-[52px] items-center justify-center rounded-[14px] bg-base text-base font-semibold text-paper transition hover:bg-surface active:scale-[0.98] lg:inline-flex lg:h-16 lg:px-12 lg:text-lg"
            >
              Criar uma câmera
            </Link>
            <p className="mt-3 text-sm font-medium opacity-90 lg:text-base">Sem app. Só um link.</p>
          </div>
        </section>

        <PhotoStrip />
        </div>

        <DuranteAFesta />
        <Revelacao />
        <FaixaPreco />

        <section id="como-funciona" className="mt-10 scroll-mt-6 bg-surface px-6 py-3 lg:mt-24 lg:grid lg:grid-cols-3 lg:rounded-[40px] lg:px-8 lg:py-16">
          {STEPS.map((step, i) => (
            <Reveal
              key={step.title}
              delay={i * 140}
              className="border-t border-line first:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0"
            >
            <div
              className="grid grid-cols-[40px_1fr] gap-x-1 py-5 lg:grid-cols-[56px_1fr] lg:px-8 lg:py-4"
            >
              <span className="pt-0.5 font-display text-[26px] text-paper lg:text-[32px]">0{i + 1}</span>
              <h2 className="font-display text-[26px] leading-tight lg:text-[36px]">{step.title}</h2>
              <p className="col-start-2 mt-1.5 text-[16px] leading-normal text-paper/80 lg:text-[18px]">{step.text}</p>
            </div>
            </Reveal>
          ))}
        </section>

        <section id="perguntas" className="mt-14 px-6 lg:mx-auto lg:mt-32 lg:max-w-[760px] lg:px-0">
          <h2 className="font-display text-[32px] leading-none lg:text-[48px]">Perguntas</h2>
          <div className="mt-6 border-t border-line">
            {PERGUNTAS.map((item) => (
              <details key={item.pergunta} className="faq group border-b border-line">
                <summary className="flex min-h-14 rounded-sm focus-visible:outline-offset-[-2px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {item.pergunta}
                  <span aria-hidden="true" className="text-muted transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="pb-5 text-[15px] leading-normal text-muted">
                  {item.resposta}
                  {item.link && (
                    <>
                      {' '}
                      <Link to={item.link.to} className="relative font-semibold text-paper underline underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-3.5 after:content-['']">
                        {item.link.texto}
                      </Link>
                      .
                    </>
                  )}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section ref={ctaFinal} className="mt-14 px-6 lg:mt-48 lg:text-center">
          <Reveal>
          <h2 className="font-display text-[40px] leading-[1.02] lg:text-[96px]">
            A festa acontece.
            <span className="block text-muted">As fotos ficam em segredo.</span>
          </h2>
          </Reveal>
          <Reveal delay={200}>
          <Link
            to="/criar"
            className="mt-6 btn-shimmer btn-shimmer-dark flex h-[52px] items-center justify-center rounded-[14px] bg-paper text-base font-semibold text-base transition hover:bg-white active:scale-[0.98] lg:mx-auto lg:mt-12 lg:h-16 lg:w-[320px] lg:text-lg"
          >
            Criar uma câmera
          </Link>
          </Reveal>
        </section>

        <footer className="flex items-center justify-between px-6 pb-24 pt-14 text-sm text-muted lg:px-0 lg:pb-10 lg:pt-24">
          <span className="flex items-center gap-2 font-display text-lg text-paper">
            <MangoLogo className="h-[18px] w-3.5" />
            mango
          </span>
          <nav aria-label="Rodapé" className="flex gap-4">
            <Link to="/termos" className="flex min-h-11 min-w-11 items-center justify-center hover:text-paper">Termos</Link>
            <Link to="/privacidade" className="flex min-h-11 min-w-11 items-center justify-center hover:text-paper">Privacidade</Link>
            <Link to="/ajuda" className="flex min-h-11 min-w-11 items-center justify-center hover:text-paper">Ajuda</Link>
          </nav>
        </footer>
      </div>

      {/* Celular: o botão fica à mão depois do hero e sai de cena no convite final.
          Vai para o body porque a transição de rota usa transform, que prenderia o fixed. */}
      {createPortal(
      <div
        inert={!mostrarCtaFixo}
        className={`cta-fixo fixed inset-x-0 bottom-0 z-20 border-t border-line bg-base px-6 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 lg:hidden ${
          mostrarCtaFixo ? '' : 'pointer-events-none translate-y-full opacity-0'
        }`}
      >
        <Link
          to="/criar"
          className="mx-auto flex h-[52px] max-w-[472px] items-center justify-center rounded-[14px] bg-paper font-semibold text-base transition active:scale-[0.98]"
        >
          Criar uma câmera
        </Link>
      </div>,
      document.body,
      )}
    </div>
  )
}

// Mostra o botão fixo quando o CTA do hero já saiu da tela e o convite final ainda não entrou.
function useCtaFixo(hero: React.RefObject<HTMLElement | null>, final: React.RefObject<HTMLElement | null>) {
  const [visivel, setVisivel] = useState({ hero: true, final: false })
  useEffect(() => {
    const h = hero.current
    const f = final.current
    if (!h || !f) return
    const io = new IntersectionObserver((entries) => {
      setVisivel((v) => {
        const novo = { ...v }
        for (const e of entries) {
          if (e.target === h) novo.hero = e.isIntersecting || e.boundingClientRect.top > 0
          if (e.target === f) novo.final = e.isIntersecting
        }
        return novo
      })
    })
    io.observe(h)
    io.observe(f)
    return () => io.disconnect()
  }, [hero, final])
  return !visivel.hero && !visivel.final
}

// Ato 2: durante a festa as fotos caem no rolo viradas para baixo.
const CONVIDADOS = [
  { nome: 'Ana', restam: 7 },
  { nome: 'Léo', restam: 15 },
  { nome: 'Bia', restam: 2 },
]
const GIROS = ['-7deg', '4deg', '-2deg', '8deg', '-4deg']

function DuranteAFesta() {
  const pilha = useReveal<HTMLDivElement>(0.35)
  return (
    <section className="mt-16 px-6 lg:mt-36 lg:grid lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16 lg:px-0">
      <div>
        <h2 className="font-display text-[40px] leading-[1.02] lg:text-[72px]">Durante a festa, cada um tem um rolo.</h2>
        <p className="mt-5 max-w-[440px] text-[17px] leading-normal text-paper/80 lg:mt-8 lg:text-[20px]">
          O convidado abre o link e fotografa. A foto vai para o rolo virada para baixo: nem quem tirou consegue
          ver. Acabaram as poses, acabou.
        </p>
      </div>

      <div ref={pilha} className="pilha mt-10 lg:mt-0">
        <div className="relative mx-auto aspect-[4/5] w-[min(78%,360px)] lg:w-[min(80%,420px)]" aria-hidden="true">
          {GIROS.map((giro, i) => (
            <div
              key={giro}
              className="quadro-virado absolute inset-0 flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.8)]"
              style={{ '--giro': giro, '--d': `${i * 90}ms`, zIndex: i } as React.CSSProperties}
            >
              <span className="text-sm font-semibold text-muted">{String(i + 1).padStart(3, '0')}</span>
              <span className="flex items-center gap-2 self-end font-display text-lg text-paper/70">
                <MangoLogo className="h-[18px] w-3.5" />
                mango
              </span>
            </div>
          ))}
        </div>
        <ul className="mx-auto mt-12 grid max-w-[420px] grid-cols-3 gap-3 text-center">
          {CONVIDADOS.map((c) => (
            <li key={c.nome} className="rounded-xl border border-line px-2 py-3">
              <span className="block font-display text-[30px] leading-none tabular-nums">{c.restam}</span>
              <span className="mt-1 block text-[13px] text-muted">poses de {c.nome}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// Ato 3: na revelação, o véu sai de cima das fotos conforme elas atravessam a tela.
const ALBUM = [
  { id: STRIP_PHOTOS[0], legenda: 'Ana, 23h41' },
  { id: STRIP_PHOTOS[1], legenda: 'Léo, 0h12' },
  { id: STRIP_PHOTOS[2], legenda: 'Bia, 1h58' },
]

function Revelacao() {
  const album = useReveal<HTMLDivElement>(0.3)
  return (
    <section className="mt-20 px-6 lg:mt-40 lg:px-0">
      <h2 className="font-display text-[40px] leading-[1.02] lg:max-w-[900px] lg:text-[72px]">
        Na manhã seguinte, o rolo vira álbum.
      </h2>
      <p className="mt-5 max-w-[460px] text-[17px] leading-normal text-paper/80 lg:mt-8 lg:text-[20px]">
        No horário que você escolher, as fotos aparecem para todo mundo ao mesmo tempo, do jeito que saíram.
      </p>
      <div ref={album} className="revelacao mt-10 grid grid-cols-2 gap-3 lg:mt-16 lg:grid-cols-3 lg:gap-6">
        {ALBUM.map((foto, i) => (
          <figure key={foto.id} className={i === 0 ? 'col-span-2 lg:col-span-1' : ''}>
            <div className={`relative overflow-hidden rounded-xl bg-surface ${i === 0 ? 'aspect-[4/3] lg:aspect-[3/4]' : 'aspect-[3/4]'}`}>
              <img src={photoUrl(foto.id)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              <div
                aria-hidden="true"
                className="veu absolute inset-0 bg-[#2a1f14]"
                style={{ '--d': `${i * 220}ms` } as React.CSSProperties}
              />
            </div>
            <figcaption className="mt-2 text-sm text-muted">{foto.legenda}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

// Ato 4: quanto custa, com os valores que o admin define (nada fixo no texto).
function FaixaPreco() {
  const config = useConfigPublica()
  const pagos = config.pacotes_pagos_disponiveis
  const params = usePrecoPublico()
  const [pacotes, setPacotes] = useState<DefinicaoPacote[] | null>(null)
  useEffect(() => {
    let ativo = true
    api.pacotes().then(
      (p) => ativo && setPacotes(p),
      () => {},
    )
    return () => {
      ativo = false
    }
  }, [])
  const teste = pacotes?.find((p) => p.gratis)
  const pagosOrdenados = (pacotes ?? []).filter((p) => !p.gratis).sort((a, b) => a.preco_centavos - b.preco_centavos)
  const menor = pagos ? pagosOrdenados[0] : undefined
  if (config.preco_dinamico) {
    const exemplo = calcularPreco(20, params, 24)
    return (
      <section className="mt-16 px-6 lg:mt-32 lg:px-0">
        <Link
          to="/precos"
          className="sobre-creme flex flex-col gap-4 rounded-[24px] bg-paper p-6 text-base transition active:scale-[0.99] lg:flex-row lg:items-end lg:justify-between lg:rounded-[40px] lg:p-14"
        >
          <span>
            <span className="block font-display text-[34px] leading-none lg:text-[56px]">Grátis para testar.</span>
            <span className="mt-3 block text-[17px] lg:text-[20px]">
              Até {params.gratis} pessoas, {params.fotosTeste} fotos cada.
              {pagos && ` Uma festa de 20 pessoas com 24 fotos cada custa ${precoExato(exemplo)}.`}
            </span>
          </span>
          <span className="font-semibold">
            <span className="border-b border-current pb-px">Calcular a minha festa</span>
          </span>
        </Link>
      </section>
    )
  }
  return (
    <section className="mt-16 px-6 lg:mt-32 lg:px-0">
      <Link
        to="/precos"
        className="sobre-creme flex flex-col gap-4 rounded-[24px] bg-paper p-6 text-base transition active:scale-[0.99] lg:flex-row lg:items-end lg:justify-between lg:rounded-[40px] lg:p-14"
      >
        <span>
          <span className="block font-display text-[34px] leading-none lg:text-[56px]">Grátis para testar.</span>
          <span className="mt-3 block min-h-[1.5em] text-[17px] lg:text-[20px]">
            {teste && `Até ${teste.convidados} convidados, ${teste.poses_max} fotos cada.`}
            {menor && ` Festas a partir de ${precoEmReais(menor.preco_centavos)}.`}
          </span>
        </span>
        <span className="font-semibold">
          <span className="border-b border-current pb-px">Ver os pacotes</span>
        </span>
      </Link>
    </section>
  )
}

// Três quadros borrados que se revelam ao toque — o gesto central do produto.
// Na abertura, um flash curto: o contador do rolo desce uma pose.
function PhotoStrip() {
  const [revealed, setRevealed] = useState<boolean[]>([false, false, false])
  const poses = useConfigPublica().poses_padrao
  const [tiradas, setTiradas] = useState(0)

  useEffect(() => {
    const flash = setTimeout(() => setTiradas(1), 950)
    const timer = setTimeout(() => setRevealed((r) => [true, r[1], r[2]]), 1600)
    return () => {
      clearTimeout(flash)
      clearTimeout(timer)
    }
  }, [])

  return (
    <div style={{ '--d': '200ms' } as React.CSSProperties} className="anim-up relative lg:self-center">
      <div aria-hidden="true" className="flash-hero pointer-events-none absolute -inset-3 z-10 rounded-3xl bg-white lg:-inset-6" />
      <div className="mx-6 mt-7 grid grid-cols-3 gap-2.5 lg:mx-0 lg:mt-0 lg:gap-6">
        {STRIP_PHOTOS.map((id, i) => (
          <button
            key={id}
            type="button"
            aria-label={revealed[i] ? `Foto ${i + 1} revelada` : `Revelar foto ${i + 1}`}
            onClick={() => setRevealed((r) => r.map((v, j) => (j === i ? !v : v)))}
            className={`frame relative aspect-[3/4.2] overflow-hidden rounded-xl bg-surface ${
              i === 1 ? 'mt-6 lg:mt-14' : i === 2 ? 'mt-2 lg:mt-5' : ''
            }`}
            style={
              {
                clipPath: 'polygon(0 0, 100% 0, 100% 86%, 86% 100%, 0 100%)',
                '--tilt': ['-2deg', '1.5deg', '-1deg'][i],
              } as React.CSSProperties
            }
          >
            <img
              src={photoUrl(id)}
              alt=""
              fetchPriority={i === 0 ? 'high' : undefined}
              className={`h-full w-full object-cover transition duration-700 ease-out ${
                revealed[i] ? '' : 'scale-110 blur-lg brightness-50 saturate-50'
              }`}
            />
            {!revealed[i] && (
              <span className="absolute bottom-0 left-0 p-2.5 text-sm font-semibold">
                00{i + 1}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mx-6 mt-5 flex items-baseline justify-between gap-4 lg:mx-0 lg:mt-10">
        <p className="text-sm text-muted lg:text-[18px]">Toque nos quadros. É assim que o álbum aparece.</p>
        <p className="shrink-0 text-sm text-muted lg:text-[18px]" aria-live="off">
          <span key={tiradas} className="anim-rota inline-block font-display text-[22px] text-paper tabular-nums lg:text-[28px]">
            {poses - tiradas}
          </span>{' '}
          poses
        </p>
      </div>
    </div>
  )
}
