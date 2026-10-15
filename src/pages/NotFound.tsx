import { Link } from 'react-router-dom'
import { MangoLogo } from '../components/MangoLogo'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-base p-6 text-center text-paper">
      <MangoLogo className="h-[42px] w-8" />
      <h1 className="font-display text-[36px] leading-none">Página não encontrada</h1>
      <p className="max-w-[320px] text-[15px] text-muted">Confira o endereço. Se veio de um convite, peça o link de novo a quem te convidou.</p>
      <Link to="/" className="mt-2 flex h-12 items-center rounded-[14px] bg-paper px-6 font-semibold text-base">
        Ir para o início
      </Link>
    </div>
  )
}
