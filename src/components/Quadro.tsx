import { Link } from 'react-router-dom'

interface QuadroProps {
  src: string
  numero: number
  apelido?: string | null
  /** Com `para`, o quadro é um link (ex.: para a foto ampliada). */
  para?: string
  className?: string
}

const numeroDoQuadro = (numero: number) => String(numero).padStart(3, '0')

// Um quadro da folha de contato: miniatura com o número e quem fotografou.
export function Quadro({ src, numero, apelido, para, className = '' }: QuadroProps) {
  const descricao = `Foto ${numero}${apelido ? ` de ${apelido}` : ''}`
  const imagem = (
    <img
      src={src}
      alt={para ? '' : descricao}
      loading="lazy"
      decoding="async"
      className="aspect-[3/4] w-full rounded-[10px] bg-surface object-cover outline outline-1 -outline-offset-1 outline-white/10"
    />
  )
  const legenda = (
    <span className="mt-1.5 flex items-baseline gap-2 text-xs">
      <span className="tabular-nums">{numeroDoQuadro(numero)}</span>
      {apelido && <span className="truncate text-muted">{apelido}</span>}
    </span>
  )

  if (para) {
    return (
      <Link to={para} aria-label={descricao} className={`block rounded-[10px] ${className}`}>
        {imagem}
        {legenda}
      </Link>
    )
  }
  return (
    <figure className={`m-0 ${className}`}>
      {imagem}
      <figcaption>{legenda}</figcaption>
    </figure>
  )
}
