import { precoExato } from '../lib/formato'
import { OPCOES_FOTOS, type ParamsPreco } from '../lib/simuladorPreco.ts'

const ATALHOS = [10, 30, 50, 100]

interface Props {
  params: ParamsPreco
  participantes: string
  fotos: number | 'ilimitado'
  /** Total em centavos já calculado, ou null enquanto a quantidade for inválida. */
  total: number | null
  erro?: string
  onParticipantes: (v: string) => void
  onFotos: (v: number | 'ilimitado') => void
}

// /criar com preço por participante: quantas pessoas e quantas fotos cada uma, com o total à vista.
export function EscolhaPessoasFotos({ params, participantes, fotos, total, erro, onParticipantes, onFotos }: Props) {
  const n = /^\d+$/.test(participantes.trim()) ? Number(participantes.trim()) : 0
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-sm font-semibold">Quantas pessoas vão fotografar?</legend>
      <input
        aria-label="Número de pessoas"
        inputMode="numeric"
        autoComplete="off"
        value={participantes}
        onChange={(e) => onParticipantes(e.target.value)}
        className="min-h-12 w-full rounded-[14px] border border-line bg-surface px-4 font-display text-[26px] tabular-nums text-paper"
      />
      <div className="flex flex-wrap gap-2">
        {ATALHOS.map((a) => (
          <button key={a} type="button" onClick={() => onParticipantes(String(a))} className={`min-h-11 min-w-12 rounded-full border px-3 text-[15px] tabular-nums transition-colors ${n === a ? 'border-paper bg-paper font-semibold text-base' : 'border-line text-muted hover:text-paper'}`}>
            {a}
          </button>
        ))}
      </div>

      <p id="criar-fotos" className="mt-2 text-sm font-semibold">Fotos por pessoa</p>
      <div role="radiogroup" aria-labelledby="criar-fotos" className="flex flex-wrap gap-2">
        {[...OPCOES_FOTOS, 'ilimitado' as const].map((o) => (
          <button key={o} type="button" role="radio" aria-checked={fotos === o} onClick={() => onFotos(o)} className={`min-h-11 rounded-full border px-4 text-[15px] transition-colors ${fotos === o ? 'border-paper bg-paper font-semibold text-base' : 'border-line text-muted hover:text-paper'}`}>
            {o === 'ilimitado' ? 'Ilimitado' : o}
          </button>
        ))}
      </div>
      {fotos === 'ilimitado' && <p className="text-sm text-muted">Até {params.tetoIlimitado} fotos por pessoa.</p>}

      <p aria-live="polite" className="rounded-[14px] border border-line px-4 py-3 text-[15px] tabular-nums">
        {total === null ? 'Informe quantas pessoas.' : total === 0 ? `Grátis: até ${params.gratis} pessoas com ${params.fotosTeste} fotos cada.` : `${precoExato(total)} no total, pagos uma vez.`}
      </p>
      {erro && (
        <p role="alert" className="text-sm text-danger-ink">
          {erro}
        </p>
      )}
    </fieldset>
  )
}
