interface ContadorPosesProps {
  restantes: number
  tamanho?: 'normal' | 'grande'
  className?: string
}

// A janelinha da câmera descartável: quantas poses sobram no rolo.
export function ContadorPoses({ restantes, tamanho = 'normal', className = '' }: ContadorPosesProps) {
  const rotulo = restantes === 1 ? 'pose' : 'poses'
  return (
    <span
      role="status"
      aria-label={`${restantes} ${rotulo} restantes`}
      className={`inline-flex flex-col items-end leading-none ${className}`}
    >
      <span
        aria-hidden="true"
        className={`font-display tabular-nums ${tamanho === 'grande' ? 'text-[56px]' : 'text-[28px]'}`}
      >
        {restantes}
      </span>
      <span aria-hidden="true" className="mt-1 text-xs text-muted">
        {rotulo}
      </span>
    </span>
  )
}
