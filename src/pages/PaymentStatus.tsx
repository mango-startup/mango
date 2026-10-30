import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BlocoEstado } from '../components/BlocoEstado'
import { Botao } from '../components/Botao'
import { MangoLogo } from '../components/MangoLogo'
import { ErroApi, api, type DefinicaoPacote, type PainelEvento, type StatusPagamento } from '../lib/api'
import { useConfigPublica } from '../lib/configPublica'
import { precoExato } from '../lib/formato'

const CONSULTA_MS = 5000
const DEMORANDO_MS = 2 * 60 * 1000

type Vista = 'confirmando' | 'aprovado' | 'cancelado' | 'pendente' | 'demorando' | 'recusado' | 'indisponivel' | 'semPagamento' | 'erro'

function Casca({ painel, children }: { painel?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-base px-5 pb-12 pt-[env(safe-area-inset-top)] text-paper">
      <header className="mx-auto flex min-h-16 max-w-[480px] items-center justify-between">
        <Link to="/" aria-label="Mango, página inicial" className="flex min-h-11 items-center">
          <MangoLogo className="h-[21px] w-4" />
        </Link>
        {painel && (
          <Link to={painel} className="flex min-h-11 items-center text-sm font-semibold text-muted transition hover:text-paper">
            Voltar ao painel
          </Link>
        )}
      </header>
      <main className="mx-auto mt-8 max-w-[480px]">{children}</main>
    </div>
  )
}

// /eventos/:id/pagamento — o evento só fica pronto quando o servidor confirma o pagamento (webhook do Stripe).
// Voltar da página do Stripe não libera nada: esta tela só consulta o estado.
export function PaymentStatusPage() {
  const pagamentoDisponivel = useConfigPublica().pacotes_pagos_disponiveis
  const { id = '' } = useParams()
  // ?stripe=ok / ?stripe=cancelado: como o cliente voltou da página de pagamento
  const voltou = useSearchParams()[0].get('stripe')
  const [painel, setPainel] = useState<PainelEvento | null>(null)
  const [pacotes, setPacotes] = useState<DefinicaoPacote[]>([])
  const [pagamento, setPagamento] = useState<StatusPagamento | null | 'carregando'>('carregando')
  const [falha, setFalha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tentando, setTentando] = useState(false)
  const desde = useRef(0)
  const [demorando, setDemorando] = useState(false)

  const consultar = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api.painel(id), api.statusPagamento(id)])
      setPainel(p)
      setPagamento(s)
      setFalha(false)
    } catch {
      setFalha(true)
    }
  }, [id])

  useEffect(() => {
    // Primeira consulta ao abrir (os setState vêm depois do await)
    desde.current = Date.now()
    const primeira = setTimeout(() => void consultar(), 0)
    let ativo = true
    api.pacotes().then(
      (p) => ativo && setPacotes(p),
      () => {},
    )
    return () => {
      clearTimeout(primeira)
      ativo = false
    }
  }, [consultar])

  // Voltar do Stripe pelo botão "voltar" do navegador pode restaurar a página parada em "abrindo...".
  useEffect(() => {
    const aoRestaurar = (e: PageTransitionEvent) => {
      if (e.persisted) setTentando(false)
    }
    window.addEventListener('pageshow', aoRestaurar)
    return () => window.removeEventListener('pageshow', aoRestaurar)
  }, [])

  const estado = painel?.evento.estado
  const aguardando = estado === 'aguardando_pagamento' || estado === 'rascunho'
  // Com o pagamento em andamento, consulta de 5 em 5 segundos e avisa se estiver demorando
  useEffect(() => {
    if (!aguardando || pagamento !== 'pendente') return
    const timer = setInterval(() => {
      void consultar()
      if (Date.now() - desde.current > DEMORANDO_MS) setDemorando(true)
    }, CONSULTA_MS)
    return () => clearInterval(timer)
  }, [aguardando, pagamento, consultar])

  // Abre (ou retoma) a página de pagamento do Stripe. O servidor reaproveita a sessão que ainda estiver aberta.
  async function irParaPagamento() {
    setTentando(true)
    setErro(null)
    try {
      const r = await api.iniciarPagamento(id)
      if (r.url) {
        window.location.assign(r.url) // sai da página: o botão continua desabilitado até lá
        return
      }
      setPagamento(r.status)
      desde.current = Date.now()
      setDemorando(false)
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não deu para abrir o pagamento. Tente de novo.')
      await consultar()
    }
    setTentando(false)
  }

  const voltar = `/eventos/${id}`
  const pacote = pacotes.find((p) => p.id === painel?.evento.pacote)
  const valorPagar = painel?.evento.valor_centavos ?? (pacote && !pacote.gratis ? pacote.preco_centavos : null)
  const rotuloPagar = valorPagar ? `Pagar ${precoExato(valorPagar)}` : 'Ir para o pagamento'
  let vista: Vista
  if (falha && !painel) vista = 'erro'
  else if (!painel || pagamento === 'carregando') vista = 'confirmando'
  else if (estado === 'cancelado') vista = 'cancelado'
  else if (estado !== 'aguardando_pagamento' && estado !== 'rascunho') vista = 'aprovado'
  else if (pagamento === 'aprovado') vista = 'aprovado'
  else if (pagamento === 'recusado') vista = 'recusado'
  else if (pagamento === null) vista = pagamentoDisponivel ? 'semPagamento' : 'indisponivel'
  else vista = demorando ? 'demorando' : 'pendente'

  return (
    <Casca painel={vista === 'confirmando' ? undefined : voltar}>
      {vista === 'confirmando' && (
        <p role="status" className="py-16 text-center text-[15px] text-muted">
          Confirmando o pagamento...
        </p>
      )}

      {vista === 'erro' && (
        <BlocoEstado
          className="py-12"
          titulo="Não deu para consultar"
          texto="Confira sua conexão. Se você já pagou, o pagamento não se perde."
          acao={<Botao onClick={() => void consultar()}>Tentar de novo</Botao>}
        />
      )}

      {vista === 'aprovado' && (
        <BlocoEstado
          className="py-12"
          titulo="Pagamento confirmado"
          texto={`${painel?.evento.nome ?? 'Seu evento'} está pronto. Agora é só mandar o link para os convidados.`}
          acao={<Botao para={voltar}>Ir para o painel</Botao>}
        />
      )}

      {vista === 'cancelado' && (
        <BlocoEstado
          className="py-12"
          titulo="Este evento foi cancelado"
          texto="Se houve cobrança, o valor volta pela mesma forma de pagamento. Você pode criar outro evento quando quiser."
          acao={<Botao para="/criar">Criar uma câmera</Botao>}
        />
      )}

      {(vista === 'pendente' || vista === 'demorando') && (
        <BlocoEstado
          className="py-12"
          titulo={vista === 'demorando' ? 'Está demorando mais que o normal' : voltou === 'ok' ? 'Pagamento recebido, confirmando' : 'Aguardando a confirmação'}
          texto={
            vista === 'demorando'
              ? 'Se você já pagou, pode levar alguns minutos para o banco avisar. Não pague de novo: esta tela atualiza sozinha. Se o Pix expirou, gere outro.'
              : 'Assim que o pagamento for confirmado, o evento fica pronto e esta tela atualiza sozinha. O Pix expira depois de um tempo.'
          }
          acao={
            <div className="flex flex-col items-center gap-2">
              <Botao onClick={() => void consultar()}>Já paguei, conferir agora</Botao>
              <Botao variante="secundario" disabled={tentando} onClick={() => void irParaPagamento()}>
                {tentando ? 'Abrindo...' : 'Voltar à página de pagamento'}
              </Botao>
            </div>
          }
        />
      )}

      {vista === 'recusado' && (
        <BlocoEstado
          className="py-12"
          titulo="O pagamento não foi concluído"
          texto="Nenhum valor foi cobrado. Dá para tentar de novo, e o evento continua guardado."
          acao={
            <Botao disabled={tentando} onClick={() => void irParaPagamento()}>
              {tentando ? 'Abrindo...' : 'Tentar de novo'}
            </Botao>
          }
        />
      )}

      {vista === 'semPagamento' && (
        <BlocoEstado
          className="py-12"
          titulo={voltou === 'cancelado' ? 'Você voltou sem pagar' : 'Falta só o pagamento'}
          texto={
            voltou === 'cancelado'
              ? 'Nada foi cobrado, e o evento continua guardado. Quando quiser, é só pagar.'
              : 'Você vai para a página de pagamento do Stripe e escolhe como pagar. O link para os convidados só funciona depois da confirmação.'
          }
          acao={
            <Botao disabled={tentando} onClick={() => void irParaPagamento()}>
              {tentando ? 'Abrindo...' : rotuloPagar}
            </Botao>
          }
        />
      )}

      {vista === 'indisponivel' && (
        <BlocoEstado
          className="py-12"
          titulo="O pagamento ainda não está disponível"
          texto="Estamos ligando o pagamento. Enquanto isso, dá para criar um evento de teste grátis. Este evento fica guardado e não é cobrado."
          acao={
            <div className="flex flex-col items-center gap-2">
              <Botao para="/criar">Criar um evento grátis</Botao>
              <Botao para={voltar} variante="discreto">
                Ver este evento
              </Botao>
            </div>
          }
        />
      )}

      {erro && (
        <p role="alert" className="mt-4 text-center text-sm text-danger-ink">
          {erro}
        </p>
      )}
      {painel && vista !== 'confirmando' && vista !== 'erro' && vista !== 'aprovado' && vista !== 'cancelado' && (
        <p className="mt-8 border-t border-line pt-4 text-center text-sm text-muted">
          {painel.evento.nome} · até {painel.evento.limite_convidados} pessoas · {painel.evento.poses_por_convidado} fotos cada
        </p>
      )}
    </Casca>
  )
}
