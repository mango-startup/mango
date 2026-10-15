import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { enviarPendentes, naoEnviadas, type Recusa } from '../../lib/filaDeEnvio'

const NOVA_TENTATIVA_MS = 15_000

/**
 * Mantém a fila de envio andando enquanto a vista está aberta: ao montar, quando a conexão volta,
 * quando o app volta à frente e a cada 15 s se ainda houver foto esperando.
 * Usado na câmera e na espera (a API aceita envios atrasados até 24 h depois do fim).
 */
export function useEnvioPendente(codigo: string, posesIniciais: number | null) {
  const [aguardando, setAguardando] = useState(0)
  const [recusa, setRecusa] = useState<Recusa | null>(null)
  const [semAcesso, setSemAcesso] = useState(false)
  const [posesNoServidor, setPosesNoServidor] = useState(posesIniciais)

  const sincronizar = useCallback(async () => {
    const resultado = await enviarPendentes(codigo)
    setAguardando(await naoEnviadas(codigo))
    if (resultado.recusadas.length > 0) setRecusa(resultado.recusadas[0])
    setSemAcesso(resultado.semAcesso)
    try {
      setPosesNoServidor((await api.eu(codigo)).poses_restantes)
    } catch {
      // sem conexão ou sem convidado neste aparelho: mantém a última contagem
    }
  }, [codigo])

  useEffect(() => {
    let ativo = true
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

  /** Foto nova entrou na fila: conta na hora e tenta enviar. */
  const adicionou = useCallback(() => {
    setAguardando((n) => n + 1)
    void sincronizar()
  }, [sincronizar])

  return { aguardando, recusa, semAcesso, posesNoServidor, adicionou }
}
