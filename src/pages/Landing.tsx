import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MangoLogo } from '../components/MangoLogo'
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
    resposta: 'Você escolhe ao criar a câmera: 12, 24 ou 36 poses, como um rolo de verdade. No teste grátis são 12. Não dá para apagar e tirar de novo.',
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
function useReveal<T extends HTMLElement>() {
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
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
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
  return (
    <div className="min-h-svh bg-base text-paper">
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
            Uma câmera descartável para a sua festa. Cada convidado leva um rolo, com 12, 24 ou 36
            poses. As fotos só aparecem quando você revelar.
          </p>
          <div style={{ '--d': '240ms' } as React.CSSProperties} className="anim-up mt-6 px-6 lg:mt-12 lg:px-14">
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

        <section id="como-funciona" className="mt-10 bg-surface px-6 py-3 lg:mt-24 lg:grid lg:grid-cols-3 lg:rounded-[40px] lg:px-8 lg:py-16">
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
                      <Link to={item.link.to} className="font-semibold text-paper underline underline-offset-4">
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

        <section className="mt-14 px-6 lg:mt-48 lg:text-center">
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

        <footer className="flex items-center justify-between px-6 pb-7 pt-14 text-sm text-muted lg:px-0 lg:pb-10 lg:pt-24">
          <span className="flex items-center gap-2 font-display text-lg text-paper">
            <MangoLogo className="h-[18px] w-3.5" />
            mango
          </span>
          <nav aria-label="Rodapé" className="flex gap-4">
            <Link to="/termos" className="flex min-h-11 items-center hover:text-paper">Termos</Link>
            <Link to="/privacidade" className="flex min-h-11 items-center hover:text-paper">Privacidade</Link>
            <Link to="/ajuda" className="flex min-h-11 items-center hover:text-paper">Ajuda</Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}

// Três quadros borrados que se revelam ao toque — o gesto central do produto.
function PhotoStrip() {
  const [revealed, setRevealed] = useState<boolean[]>([false, false, false])

  useEffect(() => {
    const timer = setTimeout(() => setRevealed((r) => [true, r[1], r[2]]), 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ '--d': '200ms' } as React.CSSProperties} className="anim-up lg:self-center">
      <div className="mx-6 mt-7 grid grid-cols-3 gap-2.5 lg:mx-0 lg:mt-0 lg:gap-5">
        {STRIP_PHOTOS.map((id, i) => (
          <button
            key={id}
            type="button"
            aria-label={revealed[i] ? `Foto ${i + 1} revelada` : `Revelar foto ${i + 1}`}
            onClick={() => setRevealed((r) => r.map((v, j) => (j === i ? !v : v)))}
            className={`frame relative aspect-[3/4.2] overflow-hidden rounded-xl bg-surface ${
              i === 1 ? 'mt-6 lg:mt-12' : i === 2 ? 'mt-2 lg:mt-4' : ''
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
      <p className="mx-6 mt-5 text-sm text-muted lg:mx-0 lg:mt-10 lg:text-[18px]">Toque nos quadros. É assim que o álbum aparece.</p>
    </div>
  )
}
