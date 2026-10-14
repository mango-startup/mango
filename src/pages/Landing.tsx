import { useEffect, useState } from 'react'
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

export function LandingPage() {
  return (
    <div className="min-h-svh bg-base text-paper">
      <div className="mx-auto max-w-[520px]">
        <section className="rounded-b-[32px] bg-paper pb-8 text-base">
          <header className="flex items-center justify-between px-6 pt-6">
            <span className="flex items-center gap-2 font-display text-[26px] leading-none">
              <MangoLogo className="h-[26px] w-5" />
              <span className="pb-1">mango</span>
            </span>
            <a href="#como-funciona" className="border-b border-current pb-px text-sm font-semibold">
              Como funciona
            </a>
          </header>

          <h1 className="mt-14 px-6 font-display text-[48px] leading-none sm:text-[54px]">
            Todo mundo
            <br />
            fotografa.
            <br />
            Ninguém vê.
          </h1>
          <p className="mt-5 max-w-[350px] px-6 text-[17px] leading-normal opacity-90">
            Uma câmera descartável para a sua festa. Cada convidado leva um rolo. As fotos só
            aparecem quando você revelar.
          </p>
          <div className="mt-6 px-6">
            <Link
              to="/camera"
              className="flex h-[52px] items-center justify-center rounded-[14px] bg-base text-base font-semibold text-paper transition active:scale-[0.98]"
            >
              Criar uma câmera
            </Link>
            <p className="mt-3 text-sm opacity-75">Sem app. Só um link.</p>
          </div>
        </section>

        <PhotoStrip />

        <section id="como-funciona" className="mt-10 bg-surface px-6 py-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="grid grid-cols-[40px_1fr] gap-x-1 border-t border-line py-5 first:border-t-0"
            >
              <span className="pt-0.5 font-display text-[22px] text-paper">0{i + 1}</span>
              <h2 className="font-display text-[26px] leading-tight">{step.title}</h2>
              <p className="col-start-2 mt-1.5 text-[15px] leading-normal text-muted">{step.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-14 px-6">
          <h2 className="font-display text-[40px] leading-[1.02]">
            A festa acontece.
            <span className="block text-muted">As fotos ficam em segredo.</span>
          </h2>
          <Link
            to="/camera"
            className="mt-6 flex h-[52px] items-center justify-center rounded-[14px] bg-paper text-base font-semibold text-base transition active:scale-[0.98]"
          >
            Criar uma câmera
          </Link>
        </section>

        <footer className="flex items-center justify-between px-6 pb-7 pt-14 text-sm text-muted">
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
    <>
      <div className="mx-6 mt-7 grid grid-cols-3 gap-2.5">
        {STRIP_PHOTOS.map((id, i) => (
          <button
            key={id}
            type="button"
            aria-label={revealed[i] ? `Foto ${i + 1} revelada` : `Revelar foto ${i + 1}`}
            onClick={() => setRevealed((r) => r.map((v, j) => (j === i ? !v : v)))}
            className={`relative aspect-[3/4.2] overflow-hidden rounded-xl bg-surface ${
              i === 1 ? 'mt-6' : i === 2 ? 'mt-2' : ''
            }`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 86%, 86% 100%, 0 100%)' }}
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
      <p className="mx-6 mt-5 text-sm text-muted">Toque nos quadros. É assim que o álbum aparece.</p>
    </>
  )
}
