import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NOME_DO_LABORATORIO } from '../../lib/laboratorio.ts'
import { Cartao, Titulo } from './ui'

// Laboratório da câmera: o site de verdade, rodando dentro de um quadro com dados de mentira. Dá para tirar fotos,
// mudar o estado do evento e ver o convidado e o anfitrião sem criar câmera, sem banco e sem pagamento.

interface Cenario {
  codigo: string
  id: string
  titulo: string
  detalhe: string
}

const CENARIOS: Cenario[] = [
  { codigo: 'ABERTA27', id: 'exemplo-aberta', titulo: 'Câmera aberta', detalhe: 'Convidado fotografando; contador de fotos e envio.' },
  { codigo: 'PRNT2345', id: 'exemplo-pronto', titulo: 'Pronto, câmera ainda fechada', detalhe: 'O convidado vê a espera até a câmera abrir.' },
  { codigo: 'ENCERRAD', id: 'exemplo-encerrada', titulo: 'Câmera encerrada', detalhe: 'Ninguém vê as fotos até a revelação.' },
  { codigo: 'REVPHT24', id: 'exemplo-revelado', titulo: 'Álbum revelado', detalhe: 'Folha de contato, foto ampliada e download.' },
  { codigo: 'PAGAMENT', id: 'exemplo-pagamento', titulo: 'Aguardando pagamento', detalhe: 'Painel do anfitrião antes de pagar.' },
  { codigo: 'EXPRAD99', id: 'exemplo-expirado', titulo: 'Álbum expirado', detalhe: 'O que aparece depois do prazo.' },
]

const ESTADOS: [string, string][] = [
  ['pronto', 'Pronto'],
  ['captura_aberta', 'Câmera aberta'],
  ['captura_encerrada', 'Encerrada'],
  ['revelado', 'Revelado'],
]

interface Ferramentas {
  forcarEstado(codigo: string, estado: string): Promise<unknown>
  resetar(): Promise<void>
}

type Visao = 'convidado' | 'anfitriao'

export function LaboratorioCamera() {
  const quadro = useRef<HTMLIFrameElement>(null)
  const [cenario, setCenario] = useState<Cenario>(CENARIOS[0])
  const [visao, setVisao] = useState<Visao>('convidado')
  const [aviso, setAviso] = useState<string | null>(null)
  const caminho = visao === 'convidado' ? `/c/${cenario.codigo}` : `/eventos/${cenario.id}`

  const ferramentas = (): Ferramentas | null => (quadro.current?.contentWindow as (Window & { mango?: Ferramentas }) | null)?.mango ?? null
  const recarregar = () => quadro.current?.contentWindow?.location.reload()

  async function forcar(estado: string, rotulo: string) {
    const f = ferramentas()
    if (!f) return setAviso('O quadro ainda está carregando. Tente de novo em um instante.')
    await f.forcarEstado(cenario.codigo, estado)
    setAviso(`"${cenario.titulo}" agora está como ${rotulo.toLowerCase()}.`)
    recarregar()
  }

  async function resetar() {
    const f = ferramentas()
    if (!f) return setAviso('O quadro ainda está carregando. Tente de novo em um instante.')
    await f.resetar()
    setAviso('Dados de teste restaurados aos exemplos.')
    recarregar()
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <Titulo detalhe="O site de verdade, rodando em dados de mentira. Dá para tirar fotos, mudar o estado do evento e ver o convidado e o anfitrião sem criar câmera, sem banco e sem pagamento. Nada daqui chega aos eventos reais.">Laboratório da câmera</Titulo>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="rounded-[44px] border border-line bg-surface p-3">
            <iframe
              ref={quadro}
              key={caminho}
              name={NOME_DO_LABORATORIO}
              title="Laboratório da câmera"
              src={caminho}
              allow="camera"
              className="h-[760px] max-h-[78svh] w-full rounded-[34px] bg-base"
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Cartao>
            <h2 className="font-display text-[22px] leading-none">Cenário</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {CENARIOS.map((c) => (
                <li key={c.codigo}>
                  <button
                    type="button"
                    aria-pressed={cenario.codigo === c.codigo}
                    onClick={() => {
                      setCenario(c)
                      setAviso(null)
                    }}
                    className={`flex min-h-[72px] w-full flex-col items-start rounded-[14px] border p-3 text-left transition-colors ${cenario.codigo === c.codigo ? 'border-paper bg-surface' : 'border-line hover:border-muted'}`}
                  >
                    <span className="text-[15px] font-semibold">{c.titulo}</span>
                    <span className="mt-0.5 text-sm text-muted">{c.detalhe}</span>
                  </button>
                </li>
              ))}
            </ul>

            <p id="lab-visao" className="mt-6 text-sm font-semibold">Quem está olhando</p>
            <div role="radiogroup" aria-labelledby="lab-visao" className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ['convidado', 'Convidado'],
                  ['anfitriao', 'Anfitrião'],
                ] as [Visao, string][]
              ).map(([v, rotulo]) => (
                <button key={v} type="button" role="radio" aria-checked={visao === v} onClick={() => setVisao(v)} className={`min-h-11 rounded-full border px-4 text-[15px] transition-colors ${visao === v ? 'border-paper bg-paper font-semibold text-base' : 'border-line text-muted hover:text-paper'}`}>
                  {rotulo}
                </button>
              ))}
            </div>
          </Cartao>

          <Cartao>
            <h2 className="font-display text-[22px] leading-none">Mudar o estado do evento</h2>
            <p className="mt-2 text-sm leading-normal text-muted">Força o cenário escolhido para outro estado, como se o tempo tivesse passado.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ESTADOS.map(([estado, rotulo]) => (
                <Button key={estado} type="button" variant="outline" onClick={() => void forcar(estado, rotulo)}>
                  {rotulo}
                </Button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={recarregar}>
                Recarregar o quadro
              </Button>
              <Button type="button" variant="ghost" onClick={() => void resetar()}>
                Voltar aos exemplos
              </Button>
            </div>
            {aviso && (
              <p role="status" className="mt-4 rounded-[12px] border border-line bg-surface px-4 py-3 text-sm">
                {aviso}
              </p>
            )}
          </Cartao>

          <Cartao>
            <h2 className="font-display text-[22px] leading-none">Como funciona por baixo</h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-[15px] leading-normal text-muted">
              <li>
                O quadro abre o site normal, mas com a api simulada (<code className="text-paper">src/lib/api/simulada.ts</code>) e dados à parte. Fotos, sessão e fila de envio ficam só neste navegador, em armazenamento com o prefixo <code className="text-paper">lab-</code>.
              </li>
              <li>
                Estados do evento: rascunho, aguardando pagamento, pronto, câmera aberta, encerrada, revelado, expirado e cancelado. O convidado fotografa só com a câmera aberta e só vê as fotos depois de revelado.
              </li>
              <li>
                Telas do convidado em <code className="text-paper">src/pages/convite/</code> e do anfitrião em <code className="text-paper">src/pages/EventDashboard.tsx</code>; a câmera em <code className="text-paper">src/components/CameraView.tsx</code>.
              </li>
              <li>
                Para desenvolver sem admin: <code className="text-paper">npm run dev</code> já usa essa mesma api simulada, e no console do navegador existem <code className="text-paper">mango.eventos()</code>, <code className="text-paper">mango.forcarEstado(código, estado)</code> e <code className="text-paper">mango.resetar()</code>.
              </li>
              <li>A câmera do celular pede permissão dentro do quadro. Para testar de verdade no aparelho, abra este admin no celular.</li>
            </ul>
          </Cartao>
        </div>
      </div>
    </div>
  )
}
