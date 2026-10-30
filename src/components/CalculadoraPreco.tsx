import { useState } from 'react'
import { Link } from 'react-router-dom'
import { precoExato } from '../lib/formato'
import { OPCOES_FOTOS, calcularPreco, participantesPagos, type ParamsPreco } from '../lib/simuladorPreco.ts'

const ATALHOS = [20, 50, 100, 200]

// Calculadora do /precos: a pessoa escolhe quantos participantes e quantas fotos e vê o total na hora.
export function CalculadoraPreco({ params, pagamentoDisponivel }: { params: ParamsPreco; pagamentoDisponivel: boolean }) {
  const [texto, setTexto] = useState('30')
  const [fotos, setFotos] = useState<number | 'ilimitado'>(24)
  const n = /^\d+$/.test(texto.trim()) ? Math.min(Number(texto.trim()), 5000) : 0
  const total = calcularPreco(n, params, fotos)
  const pagantes = participantesPagos(n, params, fotos)

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-[20px] border border-line p-5 sm:p-7">
        <label htmlFor="participantes" className="text-[17px] font-semibold">
          Quantas pessoas vão fotografar?
        </label>
        <input
          id="participantes"
          inputMode="numeric"
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="mt-3 h-14 w-full rounded-[14px] border border-line bg-surface px-4 font-display text-[28px] tabular-nums"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {ATALHOS.map((a) => (
            <button key={a} type="button" onClick={() => setTexto(String(a))} className={`min-h-11 min-w-14 rounded-full border px-4 text-[15px] tabular-nums transition-colors ${n === a ? 'border-paper bg-paper font-semibold text-base' : 'border-line text-muted hover:text-paper'}`}>
              {a}
            </button>
          ))}
        </div>

        <p id="fotos-rotulo" className="mt-7 text-[17px] font-semibold">
          Fotos por pessoa
        </p>
        <div role="radiogroup" aria-labelledby="fotos-rotulo" className="mt-3 flex flex-wrap gap-2">
          {[...OPCOES_FOTOS, 'ilimitado' as const].map((o) => (
            <button key={o} type="button" role="radio" aria-checked={fotos === o} onClick={() => setFotos(o)} className={`min-h-11 rounded-full border px-4 text-[15px] transition-colors ${fotos === o ? 'border-paper bg-paper font-semibold text-base' : 'border-line text-muted hover:text-paper'}`}>
              {o === 'ilimitado' ? 'Ilimitado' : o}
            </button>
          ))}
        </div>
        {fotos === 'ilimitado' && <p className="mt-3 text-sm text-muted">Até {params.tetoIlimitado} fotos por pessoa.</p>}
      </div>

      <div className="sobre-creme flex flex-col justify-between rounded-[20px] bg-paper p-5 text-base sm:p-7">
        <div aria-live="polite">
          <p className="text-[17px] font-semibold opacity-80">
            {n} {n === 1 ? 'pessoa' : 'pessoas'}, {fotos === 'ilimitado' ? 'fotos ilimitadas' : `${fotos} fotos cada`}
          </p>
          <p className="mt-3 font-display text-[72px] leading-none tabular-nums">{total === 0 ? 'Grátis' : precoExato(total)}</p>
          <p className="mt-3 text-[16px] opacity-80 tabular-nums">
            {total === 0 ? `Até ${params.gratis} pessoas com ${params.fotosTeste} fotos não pagam nada.` : `${precoExato(Math.round(total / n))} por pessoa, ${pagantes} ${pagantes === 1 ? 'pessoa paga' : 'pessoas pagam'}`}
          </p>
        </div>
        {pagamentoDisponivel || total === 0 ? (
          <Link to="/criar" className="mt-8 flex h-14 items-center justify-center rounded-[14px] bg-base text-base font-semibold text-paper transition active:scale-[0.98]">
            {total === 0 ? 'Testar grátis' : 'Criar uma câmera'}
          </Link>
        ) : (
          <p className="mt-8 rounded-[14px] border border-base/20 px-4 py-3 text-[15px]">Pagamento em breve. Por enquanto dá para testar de graça.</p>
        )}
      </div>
    </div>
  )
}
