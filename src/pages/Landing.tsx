import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MangoLogo } from '../components/MangoLogo'

// Fotos de exemplo do Pexels, só para a landing do protótipo
const STRIP_PHOTOS = [6224713, 6174129, 3171742]
const photoUrl = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=500`

const STEPS = [
  { title: 'Crie a câmera', text: 'Nome, data e quantas fotos cada convidado leva.' },
  { title: 'Compartilhe o link', text: 'Ninguém instala nada. Abriu, fotografou.' },
  { title: 'Revele', text: 'Quando você decidir, o rolo vira álbum. Todo mundo vê junto.' },
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
  return (
    <div className="min-h-svh bg-base text-paper">
      <div className="mx-auto max-w-[520px] lg:max-w-[1360px] lg:px-10">
        <div className="lg:mt-8 lg:grid lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1fr_1fr] lg:items-stretch lg:gap-16">
        <section className="rounded-b-[32px] bg-paper pb-8 text-base lg:flex lg:flex-col lg:rounded-[40px] lg:pb-16">
          <header className="anim-up flex items-center justify-between px-6 pt-6 lg:px-14 lg:pt-12">
            <span className="flex items-center gap-2 font-display text-[26px] leading-none">
              <MangoLogo className="h-[26px] w-5" />
              <span className="pb-1">mango</span>
            </span>
            <a href="#como-funciona" className="border-b border-current pb-px text-sm font-semibold">
              Como funciona
            </a>
          </header>

          <h1 style={{ '--d': '120ms' } as React.CSSProperties} className="anim-up mt-14 px-6 font-display text-[48px] leading-none sm:text-[54px] lg:mt-auto lg:px-14 lg:text-[88px]">
            Todo mundo
            <br />
            fotografa.
            <br />
            Ninguém vê.
          </h1>
          <p style={{ '--d': '280ms' } as React.CSSProperties} className="anim-up mt-5 max-w-[350px] px-6 text-[17px] leading-normal opacity-90 lg:mt-10 lg:max-w-[520px] lg:px-14 lg:text-[22px]">
            Uma câmera descartável para a sua festa. Cada convidado leva um rolo. As fotos só
            aparecem quando você revelar.
          </p>
          <div style={{ '--d': '440ms' } as React.CSSProperties} className="anim-up mt-6 px-6 lg:mt-12 lg:px-14">
            <Link
              to="/camera"
              className="btn-shimmer flex h-[52px] items-center justify-center rounded-[14px] bg-base text-base font-semibold text-paper transition hover:bg-surface active:scale-[0.98] lg:inline-flex lg:h-16 lg:px-12 lg:text-lg"
            >
              Criar uma câmera
            </Link>
            <p className="mt-3 text-sm opacity-75">Sem app. Só um link.</p>
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
              className="grid grid-cols-[40px_1fr] gap-x-1 py-5 lg:px-10 lg:py-4"
            >
              <span className="pt-0.5 font-display text-[22px] text-paper">0{i + 1}</span>
              <h2 className="font-display text-[26px] leading-tight lg:text-[40px]">{step.title}</h2>
              <p className="col-start-2 mt-1.5 text-[15px] leading-normal text-muted lg:text-[18px]">{step.text}</p>
            </div>
            </Reveal>
          ))}
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
            to="/camera"
            className="mt-6 btn-shimmer btn-shimmer-dark flex h-[52px] items-center justify-center rounded-[14px] bg-paper text-base font-semibold text-base transition hover:bg-white active:scale-[0.98] lg:mx-auto lg:mt-12 lg:h-16 lg:w-[320px] lg:text-lg"
          >
            Criar uma câmera
          </Link>
          </Reveal>
        </section>

        <footer className="flex items-center justify-between px-6 pb-7 pt-14 text-sm text-muted lg:px-0 lg:pb-10 lg:pt-40">
          <span className="flex items-center gap-2 font-display text-lg text-paper">
            <MangoLogo className="h-[18px] w-3.5" />
            mango
          </span>
          <span>mango.cam</span>
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
    <div style={{ '--d': '350ms' } as React.CSSProperties} className="anim-up lg:self-center">
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
                '--d': `${i * 700}ms`,
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
