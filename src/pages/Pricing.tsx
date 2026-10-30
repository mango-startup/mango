import { Link } from 'react-router-dom'
import { CalculadoraPreco } from '../components/CalculadoraPreco'
import { MangoLogo } from '../components/MangoLogo'
import { useConfigPublica } from '../lib/configPublica'
import { precoExato } from '../lib/formato'
import { usePrecoPublico } from '../lib/precoPublico'
import { calcularPreco } from '../lib/simuladorPreco'
import { useTitulo } from '../lib/useTitulo'

const EXEMPLOS: [string, number, number][] = [
  ['Jantar com amigos', 12, 24],
  ['Aniversário', 40, 24],
  ['Casamento', 150, 36],
]

// /precos — quanto custa a sua festa: pelas pessoas e pelas fotos. Os valores vêm do servidor (publicados no admin).
export function PricingPage() {
  useTitulo('Preços')
  const pagamentoDisponivel = useConfigPublica().pacotes_pagos_disponiveis
  const params = usePrecoPublico()

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
        <CalculadoraPreco params={params} pagamentoDisponivel={pagamentoDisponivel} />
        <ul className="mt-6 grid gap-3 text-[15px] text-muted sm:grid-cols-3">
          {EXEMPLOS.map(([nome, pessoas, fotos]) => (
            <li key={nome} className="rounded-[16px] border border-line p-4">
              <span className="block font-semibold text-paper">{nome}</span>
              {pessoas} pessoas, {fotos} fotos cada
              <span className="mt-2 block font-display text-[28px] text-paper tabular-nums">{precoExato(calcularPreco(pessoas, params, fotos))}</span>
            </li>
          ))}
        </ul>

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
