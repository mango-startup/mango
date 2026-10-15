import { Botao } from '../components/Botao'
import { MangoLogo } from '../components/MangoLogo'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-base p-6 text-center text-paper">
      <MangoLogo className="h-[42px] w-8" />
      <h1 className="font-display text-[36px] leading-none">Página não encontrada</h1>
      <p className="max-w-[320px] text-[15px] text-muted">Confira o endereço. Se veio de um convite, peça o link de novo a quem te convidou.</p>
      <Botao para="/" className="mt-2">
        Ir para o início
      </Botao>
    </div>
  )
}
