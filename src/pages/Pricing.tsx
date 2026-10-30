import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { Link } from 'react-router-dom'
import { CalculadoraPreco } from '../components/CalculadoraPreco'
import { MangoLogo } from '../components/MangoLogo'
import { useConfigPublica } from '../lib/configPublica'
import { precoExato } from '../lib/formato'
import { usePrecoPublico } from '../lib/precoPublico'
import { calcularPreco } from '../lib/simuladorPreco'
import { useTitulo } from '../lib/useTitulo'

interface Exemplo {
  nome: string
  pessoas: number
  fotos: number
}

const EXEMPLOS: Exemplo[] = [
  { nome: 'Jantar com amigos', pessoas: 12, fotos: 24 },
  { nome: 'Aniversário', pessoas: 40, fotos: 24 },
  { nome: 'Casamento', pessoas: 150, fotos: 36 },
]

// /precos — quanto custa a sua festa: pelas pessoas e pelas fotos. Os valores vêm do servidor (publicados no admin).
export function PricingPage() {
  useTitulo('Preços')
  const pagamentoDisponivel = useConfigPublica().pacotes_pagos_disponiveis
  const params = usePrecoPublico()
  const [texto, setTexto] = useState('30')
  const [fotos, setFotos] = useState<number | 'ilimitado'>(24)
  const [sugerido, setSugerido] = useState<Exemplo | null>(null)

  // Só troca a simulação depois do "sim" no popup, e leva a pessoa de volta para ver o resultado.
  function usarSugestao() {
    if (!sugerido) return
    setTexto(String(sugerido.pessoas))
    setFotos(sugerido.fotos)
    setSugerido(null)
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('calculadora')?.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-dvh bg-base px-5 pb-14 pt-[env(safe-area-inset-top)] text-paper">
      <header className="mx-auto flex min-h-16 max-w-[1040px] items-center justify-between">
        <Link to="/" className="flex min-h-11 items-center gap-2 font-display text-[22px] leading-none">
          <MangoLogo className="h-[21px] w-4" />
          <span className="pb-0.5">mango</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-semibold text-muted">
          <Link to="/" className="flex min-h-11 items-center transition hover:text-paper">
            Início
          </Link>
          <Link to="/eventos" className="flex min-h-11 items-center transition hover:text-paper">
            Meus eventos
          </Link>
        </nav>
      </header>

      <main className="mx-auto mt-8 max-w-[1040px]">
        <h1 className="max-w-[640px] font-display text-[44px] leading-[1.02] [text-wrap:balance] sm:text-[56px]">Você paga pelas pessoas e pelas fotos da sua festa</h1>
        <p className="mt-4 max-w-[520px] text-[17px] leading-normal text-muted">
          Grátis para testar com até {params.gratis} pessoas e {params.fotosTeste} fotos cada. Pagamento único, sem assinatura.
        </p>
        <CalculadoraPreco params={params} pagamentoDisponivel={pagamentoDisponivel} texto={texto} fotos={fotos} onTexto={setTexto} onFotos={setFotos} />
        <section aria-labelledby="sugestoes" className="mt-12">
          <h2 id="sugestoes" className="font-display text-[28px] leading-none sm:text-[32px]">
            Sugestões para você começar
          </h2>
          <p className="mt-3 max-w-[560px] text-[15px] leading-normal text-muted">São só exemplos de festas parecidas com a sua. O valor da sua festa muda com o número de pessoas e de fotos.</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {EXEMPLOS.map((e) => {
              const ativo = texto.trim() === String(e.pessoas) && fotos === e.fotos
              return (
                <li key={e.nome}>
                  <button
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setSugerido(e)}
                    className={`group flex min-h-[148px] w-full flex-col items-start rounded-[20px] border p-5 text-left transition-colors hover:border-paper/60 active:scale-[0.99] ${ativo ? 'border-paper bg-surface' : 'border-line'}`}
                  >
                    <span className="text-[17px] font-semibold">{e.nome}</span>
                    <span className="mt-1 text-[15px] text-muted">
                      {e.pessoas} pessoas, {e.fotos} fotos cada
                    </span>
                    <span className="mt-auto flex w-full items-end justify-between gap-3 pt-4">
                      <span className="font-display text-[30px] leading-none tabular-nums">{precoExato(calcularPreco(e.pessoas, params, e.fotos))}</span>
                      <span className="text-sm text-muted transition-colors group-hover:text-paper">{ativo ? 'Na calculadora' : 'Ver na calculadora'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <Dialog.Root open={sugerido !== null} onOpenChange={(aberto) => !aberto && setSugerido(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-base/80 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <Dialog.Content className="sobre-creme fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[420px] rounded-[24px] bg-paper p-6 text-base shadow-[0_24px_60px_-20px_rgb(0_0_0/0.7)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2">
              {sugerido && (
                <>
                  <Dialog.Title className="font-display text-[30px] leading-[1.05]">Ver esta sugestão na calculadora?</Dialog.Title>
                  <Dialog.Description className="mt-3 text-[16px] leading-normal opacity-80">
                    {sugerido.nome}: {sugerido.pessoas} pessoas e {sugerido.fotos} fotos cada. Isso troca os números que você está simulando agora.
                  </Dialog.Description>
                  <p className="mt-5 font-display text-[44px] leading-none tabular-nums">{precoExato(calcularPreco(sugerido.pessoas, params, sugerido.fotos))}</p>
                  <div className="mt-6 flex flex-col gap-2">
                    <button type="button" onClick={usarSugestao} className="flex h-14 items-center justify-center rounded-[14px] bg-base font-semibold text-paper transition active:scale-[0.98]">
                      Usar esta sugestão
                    </button>
                    <Dialog.Close className="flex h-12 items-center justify-center rounded-[14px] font-semibold opacity-80 transition hover:opacity-100">Agora não</Dialog.Close>
                  </div>
                </>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div className="mt-12 grid gap-6 border-t border-line pt-8 text-[15px] leading-normal text-muted sm:grid-cols-3">
          <p>
            <strong className="block font-semibold text-paper">Paga uma vez, ao criar</strong>
            Sem mensalidade. O link para os convidados funciona assim que o pagamento é confirmado.
          </p>
          <p>
            <strong className="block font-semibold text-paper">Desistiu?</strong>
            Reembolso integral enquanto ninguém tiver tirado foto.
          </p>
          <p>
            <strong className="block font-semibold text-paper">Evento muito grande?</strong>
            Formaturas e eventos muito grandes têm preço combinado.{' '}
            <Link to="/ajuda" className="text-paper underline underline-offset-2">
              Fale com a gente
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
