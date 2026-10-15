import { useEffect, useId, useRef, useState } from 'react'
import { Botao } from './Botao'

interface ConfirmacaoProps {
  pergunta: string
  detalhe?: string
  rotuloConfirmar: string
  /** Rótulo enquanto a ação roda, ex.: "Excluindo...". */
  rotuloCarregando?: string
  carregando?: boolean
  destrutiva?: boolean
  /** Exige digitar este texto (ex.: o nome do evento) antes de liberar a confirmação. */
  digitarParaConfirmar?: string
  onConfirmar: () => void
  onCancelar: () => void
  className?: string
}

// Confirmação dentro da página, no lugar de confirm() (que o navegador pode bloquear e não segue o visual).
// Começa com o foco em "Cancelar": numa ação destrutiva, o Enter distraído não apaga nada.
export function Confirmacao({
  pergunta,
  detalhe,
  rotuloConfirmar,
  rotuloCarregando,
  carregando = false,
  destrutiva = false,
  digitarParaConfirmar,
  onConfirmar,
  onCancelar,
  className = '',
}: ConfirmacaoProps) {
  const idTitulo = useId()
  const idCampo = useId()
  const cancelar = useRef<HTMLButtonElement>(null)
  const [digitado, setDigitado] = useState('')
  const liberado = !digitarParaConfirmar || digitado.trim() === digitarParaConfirmar.trim()

  useEffect(() => {
    cancelar.current?.focus()
  }, [])

  return (
    <div
      role="alertdialog"
      aria-labelledby={idTitulo}
      onKeyDown={(e) => e.key === 'Escape' && !carregando && onCancelar()}
      className={`flex flex-col gap-3 ${className}`}
    >
      <p id={idTitulo} className="text-[15px] font-semibold">
        {pergunta}
      </p>
      {detalhe && <p className="text-sm text-muted">{detalhe}</p>}
      {digitarParaConfirmar && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idCampo} className="text-sm text-muted">
            Digite <strong className="font-semibold text-paper">{digitarParaConfirmar}</strong> para confirmar
          </label>
          <input
            id={idCampo}
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            autoComplete="off"
            className="min-h-12 rounded-[10px] border border-line bg-base px-3 text-[15px] text-paper"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Botao variante={destrutiva ? 'destrutivo' : 'primario'} disabled={!liberado || carregando} onClick={onConfirmar}>
          {carregando ? (rotuloCarregando ?? rotuloConfirmar) : rotuloConfirmar}
        </Botao>
        <Botao ref={cancelar} variante="secundario" disabled={carregando} onClick={onCancelar}>
          Cancelar
        </Botao>
      </div>
    </div>
  )
}
