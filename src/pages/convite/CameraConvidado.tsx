import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BlocoEstado } from '../../components/BlocoEstado'
import { Botao } from '../../components/Botao'
import { CameraView } from '../../components/CameraView'
import { ContadorPoses } from '../../components/ContadorPoses'
import { api, type EventoPublico, type Eu } from '../../lib/api'
import { capturarParaEnvio, comprimirArquivo, type FotoParaEnvio } from '../../lib/compress'
import { quando } from '../../lib/datas'
import { enfileirar, enviarPendentes, naoEnviadas, type Recusa } from '../../lib/filaDeEnvio'
import { CascaConvite } from './CascaConvite'

interface CameraConvidadoProps {
  codigo: string
  evento: EventoPublico
  eu: Eu
}

const NOVA_TENTATIVA_MS = 15_000
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
  const [posesNoServidor, setPosesNoServidor] = useState(eu.poses_restantes)
  const [aguardando, setAguardando] = useState(0)
  const [recusa, setRecusa] = useState<Recusa | null>(null)
  const [explicar, setExplicar] = useState<boolean | null>(null)
  const [ocupada, setOcupada] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  const restantes = Math.max(0, posesNoServidor - aguardando)

  const sincronizar = useCallback(async () => {
    const resultado = await enviarPendentes(codigo)
    setAguardando(await naoEnviadas(codigo))
    if (resultado.recusadas.length > 0) setRecusa(resultado.recusadas[0])
    try {
      setPosesNoServidor((await api.eu(codigo)).poses_restantes)
    } catch {
      // sem conexão: mantém a última contagem conhecida
    }
  }, [codigo])

  // Envia o que ficou de antes, de novo quando a conexão volta ou o app volta à frente, e a cada 15 s se ainda houver fila.
  useEffect(() => {
    let ativo = true
    cameraJaLiberada().then((ok) => ativo && setExplicar(!ok))
    naoEnviadas(codigo).then((n) => ativo && setAguardando(n))
    const primeiro = setTimeout(() => void sincronizar(), 0)
    const aoVoltar = () => document.visibilityState === 'visible' && void sincronizar()
    window.addEventListener('online', sincronizar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      ativo = false
      clearTimeout(primeiro)
      window.removeEventListener('online', sincronizar)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [codigo, sincronizar])

  useEffect(() => {
    if (aguardando === 0) return
    const timer = setInterval(() => void sincronizar(), NOVA_TENTATIVA_MS)
    return () => clearInterval(timer)
  }, [aguardando, sincronizar])

  async function guardar(preparar: () => Promise<FotoParaEnvio>) {
    if (restantes <= 0 || ocupada) return
    setOcupada(true)
    try {
      await enfileirar(codigo, await preparar())
      setAguardando((n) => n + 1)
    } finally {
      setOcupada(false)
    }
    void sincronizar()
  }

  const contador = <ContadorPoses restantes={restantes} />
  const casca = (conteudo: ReactNode, telaCheia = false) => (
    <CascaConvite evento={evento.nome} acessorio={contador} telaCheia={telaCheia}>
      {conteudo}
    </CascaConvite>
  )

  const statusEnvio =
    aguardando > 0 ? (
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
