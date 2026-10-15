import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarBytes, type Resumo as DadosResumo } from '../../lib/admin.ts'
import {Aviso, Cartao, Titulo} from './ui'

const ESTADOS: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_pagamento: 'Aguardando pagamento',
  pronto: 'Pronto',
  captura_aberta: 'Câmera aberta',
  captura_encerrada: 'Câmera encerrada',
  revelado: 'Revelado',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string | number; detalhe?: string }) {
  return (
    <Cartao>
      <p className="text-sm text-muted">{rotulo}</p>
      <p className="mt-1 font-display text-[38px] leading-none tabular-nums">{valor}</p>
      {detalhe && <p className="mt-2 text-[13px] text-muted">{detalhe}</p>}
    </Cartao>
  )
}

export function Resumo() {
  const [dados, setDados] = useState<DadosResumo | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    admin
      .resumo()
      .then((r) => ativo && setDados(r))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [])

  const totalEventos = dados ? Object.values(dados.eventos_por_estado).reduce((a, b) => a + b, 0) : 0

  return (
    <>
      <Titulo detalhe="Como o Mango está agora. Preços, planos e limites ficam nas abas Pacotes e Configurações e valem na hora, sem deploy.">Resumo</Titulo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <p className="text-muted">Carregando...</p>}
      {dados && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Numero rotulo="Eventos" valor={totalEventos} detalhe={`${dados.eventos_ultimos_7_dias} criados nos últimos 7 dias`} />
            <Numero rotulo="Convidados" valor={dados.convidados} />
            <Numero rotulo="Fotos" valor={dados.fotos} detalhe={`${dados.fotos_ultimas_24_horas} nas últimas 24 horas`} />
            <Numero rotulo="Armazenamento" valor={formatarBytes(dados.armazenamento_bytes)} detalhe="Fotos guardadas no servidor" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao>
              <h2 className="mb-3 text-sm font-semibold">Eventos por estado</h2>
              {Object.keys(dados.eventos_por_estado).length === 0 ? (
                <p className="text-sm text-muted">Nenhum evento ainda.</p>
              ) : (
                <ul className="divide-y divide-line text-[15px]">
                  {Object.entries(dados.eventos_por_estado).map(([estado, n]) => (
                    <li key={estado} className="flex justify-between py-2">
                      <span>{ESTADOS[estado] ?? estado}</span>
                      <span className="tabular-nums text-muted">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
            <Cartao>
              <h2 className="mb-3 text-sm font-semibold">Pontos de atenção</h2>
              <ul className="flex flex-col gap-2 text-[15px] text-muted">
                <li>
                  Pedidos de remoção de foto pendentes: <strong className="tabular-nums text-paper">{dados.pedidos_de_remocao_pendentes}</strong>
                </li>
                <li>
                  <Link to="/admin/configuracoes" className="underline underline-offset-4 hover:text-paper">
                    Pausar a criação de eventos
                  </Link>{' '}
                  em caso de manutenção.
                </li>
                <li>
                  <Link to="/admin/auditoria" className="underline underline-offset-4 hover:text-paper">
                    Ver quem mudou o quê
                  </Link>
                  .
                </li>
              </ul>
            </Cartao>
          </div>
        </div>
      )}
    </>
  )
}
