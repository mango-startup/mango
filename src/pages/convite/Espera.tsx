import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EventoPublico, Eu } from '../../lib/api'
import { quando } from '../../lib/datas'
import { CascaConvite } from './CascaConvite'
import { useEnvioPendente } from './useEnvioPendente'

interface EsperaProps {
  codigo: string
  evento: EventoPublico
  /** null quando este aparelho não fotografou. */
  eu: Eu | null
}

const HORA_MS = 60 * 60 * 1000

/** "13:20:04" até 24 h; depois, "2 dias". */
function contagem(ms: number): string {
  if (ms >= 48 * HORA_MS) return `${Math.round(ms / (24 * HORA_MS))} dias`
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

// A câmera fechou e o rolo está no laboratório: contagem até a revelação, nenhuma miniatura.
// Também mantém a fila de envio andando (envios atrasados valem até 24 h depois do fim).
export function Espera({ codigo, evento, eu }: EsperaProps) {
  const { aguardando } = useEnvioPendente(codigo, null)
  const [agora, setAgora] = useState(() => Date.now())
  const alvo = !evento.revelacao_manual && evento.revelacao_em ? new Date(evento.revelacao_em).getTime() : null

  useEffect(() => {
    if (alvo === null) return
    const timer = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [alvo])

  const minhas = eu ? eu.fotos.length : 0

  return (
    <CascaConvite evento={evento.nome}>
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pb-6">
        <div className="anim-in my-auto py-10">
          {alvo !== null ? (
            <>
              <p className="text-[15px] text-muted">Revelação em</p>
              <p className="mt-2 font-display text-[64px] leading-none tabular-nums" aria-live="off">
                {contagem(alvo - agora)}
              </p>
              <p className="mt-3 text-[15px] text-muted">{quando(evento.revelacao_em!)}</p>
            </>
          ) : (
            <>
              <h1 className="font-display text-[44px] leading-[1.02] [text-wrap:balance]">O rolo está no laboratório</h1>
              <p className="mt-3 text-[15px] text-muted">As fotos aparecem quando o anfitrião revelar.</p>
            </>
          )}

          <dl className="mt-10 flex flex-col border-y border-line">
            {evento.fotos !== undefined && (
              <div className="flex items-baseline justify-between py-4">
                <dt className="text-[15px] text-muted">Fotos no rolo</dt>
                <dd className="font-display text-[28px] leading-none tabular-nums">{evento.fotos}</dd>
              </div>
            )}
            {eu && (
              <div className="flex items-baseline justify-between border-t border-line py-4 first:border-t-0">
                <dt className="text-[15px] text-muted">Suas fotos enviadas</dt>
                <dd className="font-display text-[28px] leading-none tabular-nums">{minhas}</dd>
              </div>
            )}
          </dl>

          {aguardando > 0 && (
            <p role="status" className="mt-4 text-sm text-muted">
              {aguardando === 1 ? '1 foto sua ainda está subindo.' : `${aguardando} fotos suas ainda estão subindo.`} Deixe esta página aberta.
            </p>
          )}
          <p className="mt-6 text-[15px]">Volte neste mesmo link para ver o álbum.</p>
        </div>

        <p className="border-t border-line pt-4 text-center text-sm text-muted">
          Feito com Mango ·{' '}
          <Link to="/" className="font-semibold text-paper underline underline-offset-2">
            crie a sua
          </Link>
        </p>
      </div>
    </CascaConvite>
  )
}
