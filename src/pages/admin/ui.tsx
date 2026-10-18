import { useId, type ReactNode } from 'react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'

// Só componentes aqui; os utilitários ficam em ./util.ts (o fast refresh exige isso).

// Peças pequenas só da área de admin. O visual segue os tokens do site (base, surface, line, paper, muted).

export function Titulo({ children, detalhe }: { children: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[34px] leading-none">{children}</h1>
      {detalhe && <p className="mt-2 max-w-[640px] text-[15px] leading-normal text-muted">{detalhe}</p>}
    </div>
  )
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-line bg-surface/60 p-5 ${className}`}>{children}</section>
}

interface CampoProps {
  rotulo: string
  erro?: string
  ajuda?: ReactNode
  /** Recebe o id para ligar o <label> ao controle. */
  children: (id: string) => ReactNode
}

export function Campo({ rotulo, erro, ajuda, children }: CampoProps) {
  const id = useId()
  return (
    <Field data-invalid={erro ? true : undefined}>
      <FieldLabel htmlFor={id}>{rotulo}</FieldLabel>
      {children(id)}
      {ajuda && <FieldDescription>{ajuda}</FieldDescription>}
      {erro && <FieldError>{erro}</FieldError>}
    </Field>
  )
}

export function Aviso({ tipo, children }: { tipo: 'erro' | 'ok'; children: ReactNode }) {
  return (
    <p role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-[12px] border px-4 py-3 text-sm ${tipo === 'erro' ? 'border-danger/60 bg-danger/10 text-danger-ink' : 'border-line bg-surface text-paper'}`}>
      {children}
    </p>
  )
}

export function Interruptor({ marcado, onMudar, rotulo, desabilitado }: { marcado: boolean; onMudar: (v: boolean) => void; rotulo: string; desabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={marcado}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={() => onMudar(!marcado)}
      className={`relative h-8 w-14 shrink-0 rounded-full border border-line transition-colors disabled:opacity-40 ${marcado ? 'bg-paper' : 'bg-surface'}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full transition-all ${marcado ? 'left-7 bg-base' : 'left-1 bg-muted'}`} />
    </button>
  )
}
