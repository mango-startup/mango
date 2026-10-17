import { useEffect, useState } from 'react'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type ModeracaoAdmin } from '../../lib/admin.ts'
import { Aviso, Cartao, Titulo } from './ui'
import { dataHora } from './util'

export function Moderacao() {
  const [dados, setDados] = useState<ModeracaoAdmin | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    admin
      .moderacao()
      .then((r) => ativo && setDados(r))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [])

  return (
    <>
      <Titulo detalhe="Pedidos de remoção de foto feitos por convidados. Quem decide é o anfitrião do evento; aqui você acompanha o que está parado.">Moderação</Titulo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <p className="text-muted">Carregando...</p>}
      {dados && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Cartao>
              <p className="text-sm text-muted">Pendentes</p>
              <p className="mt-1 font-display text-[38px] leading-none tabular-nums">{dados.pendentes.length}</p>
            </Cartao>
            <Cartao>
              <p className="text-sm text-muted">Fotos removidas</p>
              <p className="mt-1 font-display text-[38px] leading-none tabular-nums">{dados.resolvidos.removida}</p>
            </Cartao>
            <Cartao>
              <p className="text-sm text-muted">Fotos mantidas</p>
              <p className="mt-1 font-display text-[38px] leading-none tabular-nums">{dados.resolvidos.mantida}</p>
            </Cartao>
          </div>
          <Cartao className="overflow-x-auto p-0">
            {dados.pendentes.length === 0 ? (
              <p className="p-5 text-muted">Nenhum pedido pendente.</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-[14px]">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Pedido em</th>
                    <th className="px-4 py-3 font-semibold">Evento</th>
                    <th className="px-4 py-3 font-semibold">Anfitrião</th>
                    <th className="px-4 py-3 font-semibold">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dados.pendentes.map((p) => (
                    <tr key={p.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{dataHora(p.criado_em)}</td>
                      <td className="px-4 py-3">{p.evento_nome}</td>
                      <td className="px-4 py-3 text-muted">{p.anfitriao_email}</td>
                      <td className="px-4 py-3 text-muted">{p.motivo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>
        </div>
      )}
    </>
  )
}
