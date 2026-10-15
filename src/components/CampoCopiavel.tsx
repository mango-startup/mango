import { useId, useRef, useState } from 'react'
import { copiar } from '../lib/formato'
import { Icone } from './Icone'

interface CampoCopiavelProps {
  rotulo: string
  valor: string
  ajuda?: string
}

// Link exibido como texto selecionável, com botão de copiar. Se o navegador recusar a cópia, seleciona o texto.
export function CampoCopiavel({ rotulo, valor, ajuda }: CampoCopiavelProps) {
  const id = useId()
  const campo = useRef<HTMLInputElement>(null)
  const [estado, setEstado] = useState<'parado' | 'copiado' | 'selecione'>('parado')

  async function aoCopiar() {
    if (await copiar(valor)) {
      setEstado('copiado')
      setTimeout(() => setEstado('parado'), 2000)
    } else {
      campo.current?.select()
      setEstado('selecione')
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {rotulo}
      </label>
      <div className="flex gap-2">
        <input
          ref={campo}
          id={id}
          readOnly
          value={valor}
          onFocus={(e) => e.target.select()}
          className="min-h-12 min-w-0 flex-1 rounded-[14px] border border-line bg-base px-4 text-[15px] text-paper"
        />
        <button
          type="button"
          onClick={() => void aoCopiar()}
          className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-[14px] border border-line px-4 text-[15px] font-semibold transition hover:bg-surface active:scale-[0.98]"
        >
          <Icone nome="copiar" className="h-5 w-5" />
          <span aria-live="polite">{estado === 'copiado' ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      {estado === 'selecione' && <p className="text-sm text-muted">Selecionado. Use o copiar do seu celular.</p>}
      {ajuda && <p className="text-sm text-muted">{ajuda}</p>}
    </div>
  )
}
