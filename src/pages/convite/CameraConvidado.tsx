import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BlocoEstado } from '../../components/BlocoEstado'
import { Botao } from '../../components/Botao'
import { CameraView } from '../../components/CameraView'
import { ContadorPoses } from '../../components/ContadorPoses'
import type { EventoPublico, Eu } from '../../lib/api'
import { capturarParaEnvio, comprimirArquivo, type FotoParaEnvio } from '../../lib/compress'
import { quando } from '../../lib/datas'
import { enfileirar } from '../../lib/filaDeEnvio'
import { CascaConvite } from './CascaConvite'
import { useEnvioPendente } from './useEnvioPendente'

interface CameraConvidadoProps {
  codigo: string
  evento: EventoPublico
  eu: Eu
}

const CHAVE_PERMISSAO = 'mango.camera-explicada'

/** Já explicamos a câmera neste aparelho, ou o navegador já deu a permissão? */
async function cameraJaLiberada(): Promise<boolean> {
  try {
    if (localStorage.getItem(CHAVE_PERMISSAO)) return true
  } catch {
    // armazenamento bloqueado: segue para a consulta de permissão
  }
  try {
    const estado = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return estado.state === 'granted'
  } catch {
    return false
  }
}

function lembrarPermissao() {
  try {
    localStorage.setItem(CHAVE_PERMISSAO, '1')
  } catch {
    // sem problema: só mostra a explicação de novo
  }
}

function textoRevelacao(e: EventoPublico) {
  return e.revelacao_manual || !e.revelacao_em ? 'quando o anfitrião revelar' : quando(e.revelacao_em)
}

// Câmera do convidado: dispara na hora, guarda a foto no aparelho e envia em segundo plano.
export function CameraConvidado({ codigo, evento, eu }: CameraConvidadoProps) {
  const { aguardando, recusa, semAcesso, posesNoServidor, adicionou } = useEnvioPendente(codigo, eu.poses_restantes)
  const [explicar, setExplicar] = useState<boolean | null>(null)
  const [ocupada, setOcupada] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  const restantes = Math.max(0, (posesNoServidor ?? eu.poses_restantes) - aguardando)

  useEffect(() => {
    let ativo = true
    cameraJaLiberada().then((ok) => ativo && setExplicar(!ok))
    return () => {
      ativo = false
    }
  }, [])

  async function guardar(preparar: () => Promise<FotoParaEnvio>) {
    if (restantes <= 0 || ocupada) return
    setOcupada(true)
    try {
      await enfileirar(codigo, await preparar())
      adicionou()
    } finally {
      setOcupada(false)
    }
  }

  const contador = <ContadorPoses restantes={restantes} />
  const casca = (conteudo: ReactNode, telaCheia = false) => (
    <CascaConvite evento={evento.nome} acessorio={contador} telaCheia={telaCheia}>
      {conteudo}
    </CascaConvite>
  )

  const statusEnvio = semAcesso ? (
    <p role="alert" className="px-4 text-sm text-danger-ink">
      Este aparelho perdeu o acesso ao evento. Suas {aguardando} {aguardando === 1 ? 'foto está guardada' : 'fotos estão guardadas'}; peça ao anfitrião para conferir o link e abra o convite de novo.
    </p>
  ) : aguardando > 0 ? (
      <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-paper/70" />
        {aguardando === 1 ? '1 foto aguardando envio' : `${aguardando} fotos aguardando envio`}
      </p>
    ) : null

  const inputSistema = (
    <input
      ref={arquivo}
      type="file"
      accept="image/*"
      capture="environment"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const escolhido = e.target.files?.[0]
        e.target.value = ''
        if (escolhido) void guardar(() => comprimirArquivo(escolhido))
      }}
    />
  )

  if (recusa === 'captura_fechada') {
    return casca(
      <BlocoEstado className="flex-1" titulo="A câmera fechou" texto={`As fotos já enviadas aparecem na revelação, ${textoRevelacao(evento)}.`} />,
    )
  }

  if (restantes === 0) {
    return casca(
      <div className="flex flex-1 flex-col">
        <BlocoEstado
          className="flex-1"
          titulo="Acabou o seu rolo"
          texto={`Suas fotos aparecem na revelação, ${textoRevelacao(evento)}. Volte neste mesmo link.`}
        />
        {statusEnvio && <div className="pb-8">{statusEnvio}</div>}
        {aguardando > 0 && <p className="px-6 pb-8 text-center text-xs text-muted">Não limpe os dados do navegador até as fotos terminarem de subir.</p>}
      </div>,
    )
  }

  if (explicar === null) return casca(null)

  if (explicar) {
    return casca(
      <BlocoEstado
        className="flex-1"
        titulo="Agora, a câmera"
        texto="O navegador vai pedir para usar a câmera. Toque em Permitir para fotografar. Suas fotos só aparecem na revelação."
        acao={
          <Botao
            onClick={() => {
              lembrarPermissao()
              setExplicar(false)
            }}
          >
            Continuar
          </Botao>
        }
      />,
    )
  }

  return casca(
    <>
      {inputSistema}
      <CameraView
        disabled={ocupada}
        onCapture={(video) => void guardar(() => capturarParaEnvio(video))}
        caption={
          recusa === 'sem_poses' ? (
            <p className="text-sm text-danger-ink">Uma foto não entrou: o limite de poses foi atingido.</p>
          ) : (
            statusEnvio
          )
        }
        fallback={
          <Botao variante="discreto" onClick={() => arquivo.current?.click()}>
            Usar a câmera do celular
          </Botao>
        }
      />
    </>,
    true,
  )
}
