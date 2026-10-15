import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { BlocoEstado } from '../components/BlocoEstado'
import { Botao } from '../components/Botao'
import { ErroApi, api, type EventoPublico, type Eu } from '../lib/api'
import { dataPorExtenso, quando } from '../lib/datas'
import { BoasVindas } from './convite/BoasVindas'
import { CameraConvidado } from './convite/CameraConvidado'
import { CascaConvite } from './convite/CascaConvite'

type Carga =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; naoEncontrado: boolean }
  | { tipo: 'ok'; evento: EventoPublico; eu: Eu | null }

/** Este aparelho já entrou no evento? (sem token, a api responde nao_autorizado) */
async function lerEu(codigo: string): Promise<Eu | null> {
  try {
    return await api.eu(codigo)
  } catch (e) {
    if (e instanceof ErroApi && e.erro === 'nao_autorizado') return null
    throw e
  }
}

async function lerConvite(codigo: string): Promise<Carga> {
  try {
    const [evento, eu] = await Promise.all([api.eventoPublico(codigo), lerEu(codigo)])
    return { tipo: 'ok', evento, eu }
  } catch (e) {
    return { tipo: 'erro', naoEncontrado: e instanceof ErroApi && e.erro === 'nao_encontrado' }
  }
}

/** Próximo horário em que o estado muda sozinho, para recarregar na hora certa. */
function proximaMudanca(e: EventoPublico): string | null {
  if (e.estado === 'pronto') return e.captura_inicio
  if (e.estado === 'captura_aberta') return e.captura_fim
  if (e.estado === 'captura_encerrada' && !e.revelacao_manual) return e.revelacao_em
  if (e.estado === 'revelado') return e.expira_em
  return null
}

const MAX_TIMEOUT_MS = 2_147_483_647
const CONSULTA_REVELACAO_MANUAL_MS = 60_000

// /c/:codigo — um link por evento, do convite ao álbum. A vista muda conforme o estado do evento.
export function InvitePage() {
  const { codigo = '' } = useParams()
  const [carga, setCarga] = useState<Carga>({ tipo: 'carregando' })

  const carregar = useCallback(() => lerConvite(codigo).then(setCarga), [codigo])

  useEffect(() => {
    let ativo = true
    lerConvite(codigo).then((c) => ativo && setCarga(c))
    return () => {
      ativo = false
    }
  }, [codigo])

  // Recarrega sozinho quando a câmera abre, fecha, revela ou expira.
  const evento = carga.tipo === 'ok' ? carga.evento : null
  useEffect(() => {
    if (!evento) return
    const proxima = proximaMudanca(evento)
    const espera =
      evento.estado === 'captura_encerrada' && evento.revelacao_manual
        ? CONSULTA_REVELACAO_MANUAL_MS
        : proxima
          ? Math.max(0, new Date(proxima).getTime() - Date.now()) + 1000
          : null
    if (espera === null) return
    const timer = setTimeout(() => void carregar(), Math.min(espera, MAX_TIMEOUT_MS))
    return () => clearTimeout(timer)
  }, [evento, carregar])

  if (carga.tipo === 'carregando') {
    return (
      <CascaConvite>
        <p role="status" className="m-auto text-[15px] text-muted">
          Abrindo o convite...
        </p>
      </CascaConvite>
    )
  }

  if (carga.tipo === 'erro') {
    return (
      <CascaConvite>
        {carga.naoEncontrado ? (
          <BlocoEstado
            className="flex-1"
            titulo="Convite não encontrado"
            texto="Confira o link. Se o anfitrião trocou o link do evento, peça o novo a quem te convidou."
          />
        ) : (
          <BlocoEstado
            className="flex-1"
            titulo="Não foi possível abrir o convite"
            texto="Confira sua conexão e tente de novo."
            acao={<Botao onClick={() => void carregar()}>Tentar de novo</Botao>}
          />
        )}
      </CascaConvite>
    )
  }

  const { evento: e, eu } = carga
  const casca = (conteudo: ReactNode, acessorio?: ReactNode) => (
    <CascaConvite evento={e.nome} acessorio={acessorio}>
      {conteudo}
    </CascaConvite>
  )

  switch (e.estado) {
    case 'rascunho':
    case 'aguardando_pagamento':
      return casca(
        <BlocoEstado className="flex-1" titulo="A câmera ainda não está pronta" texto="Quem te convidou ainda está preparando o evento. Volte neste mesmo link mais tarde." />,
      )

    case 'pronto':
      return casca(
        <BlocoEstado
          className="flex-1"
          titulo={e.captura_inicio ? `A câmera abre ${quando(e.captura_inicio)}` : 'A câmera ainda não abriu'}
          texto={`Cada convidado leva ${e.poses_por_convidado} poses. Volte neste mesmo link na hora da festa.`}
        />,
      )

    case 'cancelado':
      return casca(<BlocoEstado className="flex-1" titulo="Este evento foi cancelado" texto="Fale com quem te convidou." />)

    case 'expirado':
      return casca(
        <BlocoEstado
          className="flex-1"
          titulo="Este álbum expirou"
          texto={e.expira_em ? `As fotos ficaram disponíveis até ${dataPorExtenso(e.expira_em)}.` : undefined}
        />,
      )

    case 'captura_aberta':
      if (eu) return <CameraConvidado codigo={codigo} evento={e} eu={eu} />
      if (e.lotado) {
        return casca(
          <BlocoEstado className="flex-1" titulo="Este evento atingiu o limite de convidados" texto="Avise quem te convidou: dá para aumentar o limite." />,
        )
      }
      return casca(<BoasVindas codigo={codigo} evento={e} onEntrou={() => void carregar()} onMudou={() => void carregar()} />)

    case 'captura_encerrada':
      // Tela de espera: issue #20
      return casca(
        <BlocoEstado
          className="flex-1"
          titulo="A câmera fechou"
          texto={
            e.revelacao_manual || !e.revelacao_em
              ? 'As fotos aparecem quando o anfitrião revelar. Volte neste mesmo link.'
              : `Revelação ${quando(e.revelacao_em)}. Volte neste mesmo link.`
          }
        />,
      )

    case 'revelado':
      if (e.album_privado) {
        return casca(<BlocoEstado className="flex-1" titulo="Álbum privado" texto="O anfitrião deixou este álbum visível só para ele." />)
      }
      // Revelação e álbum: issues #21 e #22
      return casca(<BlocoEstado className="flex-1" titulo="Revelado" texto="A revelação e o álbum chegam nas issues #21 e #22." />)
  }
}
