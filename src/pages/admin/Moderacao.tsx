import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type ModeracaoAdmin } from '../../lib/admin.ts'
import { Aviso, Cartao, Titulo, Carregando, EstadoVazio } from './ui'
import { dataHora, rotuloEmail } from './util'

export function Moderacao() {
  const [dados, setDados] = useState<ModeracaoAdmin | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    admin
      .moderacao()
      .then((r) => ativo && setDados(r))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [versao])

  const alternar = (id: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual)
      if (!novo.delete(id)) novo.add(id)
      return novo
    })

  const resolver = async (resolucao: 'removida' | 'mantida') => {
    const ids = [...marcados]
    const rotulo = resolucao === 'removida' ? 'Remover as fotos de' : 'Manter as fotos de'
    if (!window.confirm(`${rotulo} ${ids.length} pedido(s)? Fica registrado na auditoria.`)) return
    setSalvando(true)
    try {
      await admin.resolverPedidos(ids, resolucao)
      setMarcados(new Set())
      setErro(null)
      setVersao((v) => v + 1)
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <Titulo detalhe="Pedidos de remoção de foto feitos por convidados. O anfitrião costuma decidir; quando um pedido ficar parado, resolva aqui, um a um ou em lote.">Moderação</Titulo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <Carregando />}
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
          {marcados.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-line bg-surface px-4 py-3">
              <span className="mr-auto text-sm">{marcados.size} selecionado(s)</span>
              <Button type="button" variant="outline" disabled={salvando} onClick={() => void resolver('mantida')}>
                Manter fotos
              </Button>
              <Button type="button" disabled={salvando} onClick={() => void resolver('removida')}>
                Remover fotos
              </Button>
            </div>
          )}
          <Cartao className="overflow-x-auto p-0">
            {dados.pendentes.length === 0 ? (
              <EstadoVazio>Nenhum pedido pendente.</EstadoVazio>
            ) : (
              <table className="tabela-cards w-full sm:min-w-[720px] text-left text-[14px]">
                <thead className="sticky top-0 border-b border-line bg-surface text-muted">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Selecionar todos"
                        checked={marcados.size === dados.pendentes.length}
                        onChange={() => setMarcados(marcados.size === dados.pendentes.length ? new Set() : new Set(dados.pendentes.map((p) => p.id)))}
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Pedido em</th>
                    <th className="px-4 py-3 font-semibold">Evento</th>
                    <th className="px-4 py-3 font-semibold">Anfitrião</th>
                    <th className="px-4 py-3 font-semibold">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line [&_tr:hover]:bg-surface/70">
                  {dados.pendentes.map((p) => (
                    <tr key={p.id} className="align-top">
                      <td className="px-4 py-3">
                        <input type="checkbox" aria-label={`Selecionar pedido de ${p.evento_nome}`} checked={marcados.has(p.id)} onChange={() => alternar(p.id)} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{dataHora(p.criado_em)}</td>
                      <td className="px-4 py-3">{p.evento_nome}</td>
                      <td className="px-4 py-3 text-muted">{rotuloEmail(p.anfitriao_email)}</td>
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
