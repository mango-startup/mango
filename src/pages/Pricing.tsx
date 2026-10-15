import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Botao } from '../components/Botao'
import { MangoLogo } from '../components/MangoLogo'
import { api, type DefinicaoPacote } from '../lib/api'
import { useConfigPublica } from '../lib/configPublica'
import { precoEmReais } from '../lib/formato'

function retencao(dias: number): string {
  return dias >= 365 ? `${Math.round(dias / 30)} meses` : `${dias} dias`
}

function poses(opcoes: number[]): string {
  return opcoes.length === 1 ? `${opcoes[0]} poses` : `${opcoes.slice(0, -1).join(', ')} ou ${opcoes.at(-1)} poses`
}

// /precos — escolha pelo tamanho da festa. Os valores vêm da api, não ficam presos no componente.
export function PricingPage() {
  const pagamentoDisponivel = useConfigPublica().pacotes_pagos_disponiveis
  const [pacotes, setPacotes] = useState<DefinicaoPacote[] | null>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    let ativo = true
    api.pacotes().then(
      (p) => ativo && setPacotes(p),
      () => ativo && setFalhou(true),
    )
    return () => {
      ativo = false
    }
  }, [])

  return (
    <div className="min-h-dvh bg-base px-5 pb-14 pt-[env(safe-area-inset-top)] text-paper">
      <header className="mx-auto flex min-h-16 max-w-[1040px] items-center justify-between">
        <Link to="/" className="flex min-h-11 items-center gap-2 font-display text-[22px] leading-none">
          <MangoLogo className="h-[21px] w-4" />
          <span className="pb-0.5">mango</span>
        </Link>
        <Link to="/eventos" className="flex min-h-11 items-center text-sm font-semibold text-muted transition hover:text-paper">
          Meus eventos
        </Link>
      </header>

      <main className="mx-auto mt-8 max-w-[1040px]">
        <h1 className="max-w-[640px] font-display text-[44px] leading-[1.02] [text-wrap:balance] sm:text-[56px]">Um preço por festa, pelo número de convidados</h1>
        <p className="mt-4 max-w-[520px] text-[17px] leading-normal text-muted">Pagamento único. Sem assinatura, sem app para ninguém instalar.</p>

        {falhou && <p className="mt-10 text-[15px] text-danger-ink">Não foi possível carregar os preços. Confira sua conexão e recarregue a página.</p>}
        {!pacotes && !falhou && (
          <p role="status" className="mt-10 text-[15px] text-muted">
            Carregando...
          </p>
        )}

        {pacotes && (
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pacotes.map((p) => (
              <li
                key={p.id}
                className={`flex flex-col rounded-[20px] p-5 ${p.id === 'celebracao' ? 'sobre-creme bg-paper text-base' : 'border border-line'}`}
              >
                <p className={`text-sm font-semibold ${p.id === 'celebracao' ? 'opacity-70' : 'text-muted'}`}>{p.nome}</p>
                <p className="mt-4 font-display leading-none">
                  <span className="block text-[18px]">até</span>
                  <span className="text-[64px] tabular-nums">{p.convidados}</span>
                  <span className="ml-2 text-[18px]">convidados</span>
                </p>
                <p className="mt-4 text-[22px] font-semibold tabular-nums">{p.gratis ? 'Grátis' : precoEmReais(p.preco_centavos)}</p>
                {!p.gratis && !pagamentoDisponivel && <p className="mt-1 text-sm opacity-70">Pagamento em breve</p>}
                <ul className={`mt-5 flex flex-1 flex-col gap-2 border-t pt-4 text-[15px] leading-snug ${p.id === 'celebracao' ? 'border-base/15' : 'border-line'}`}>
                  <li>{poses(p.poses_opcoes)} por convidado</li>
                  <li>Álbum no ar por {retencao(p.retencao_dias)}</li>
                  <li>Download de todas as fotos</li>
                  {p.gratis && <li>Bom para testar num jantar</li>}
                </ul>
                {p.gratis || pagamentoDisponivel ? (
                  <Botao para={`/criar?pacote=${p.id}`} variante={p.id === 'celebracao' ? 'escuro' : 'secundario'} className="mt-6 w-full">
                    {p.gratis ? 'Testar grátis' : `Escolher ${p.nome}`}
                  </Botao>
                ) : (
                  <Botao variante="secundario" disabled className="mt-6 w-full">
                    Em breve
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        )}

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
            <strong className="block font-semibold text-paper">Mais de 200 convidados?</strong>
            Casamentos e formaturas grandes têm preço combinado.{' '}
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
