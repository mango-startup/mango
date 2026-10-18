import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type PaginaAuditoria } from '../../lib/admin.ts'
import {Aviso, Cartao, Titulo} from './ui'
import { campoTexto, dataHora } from './util'

const ACOES: Record<string, string> = {
  'config.alterar': 'Alterou configuração',
  'config.restaurar': 'Voltou ao padrão',
  'pacote.criar': 'Criou pacote',
  'pacote.alterar': 'Alterou pacote',
  'admin.entrar': 'Entrou',
  'admin.trocar_senha': 'Trocou a senha',
  'admin.redefinir_senha': 'Redefiniu a senha de',
  'admin.conta_bloqueada': 'Conta bloqueada por tentativas',
}

function resumo(valor: unknown): string {
  if (valor === null || valor === undefined) return '—'
  if (typeof valor === 'object') {
    const t = JSON.stringify(valor)
    return t.length > 140 ? `${t.slice(0, 137)}...` : t
  }
  return String(valor)
}

export function Auditoria() {
  const [pagina, setPagina] = useState(1)
  const [usuario, setUsuario] = useState('')
  const [acao, setAcao] = useState('')
  const [usuarios, setUsuarios] = useState<string[]>([])
  const [dados, setDados] = useState<PaginaAuditoria | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    admin
      .auditoria(pagina, 50, { usuario, acao })
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [pagina, usuario, acao])

  useEffect(() => {
    admin.administradores().then((l) => setUsuarios(l.map((a) => a.usuario))).catch(() => {})
  }, [])

  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.limite)) : 1

  return (
    <>
      <Titulo detalhe="Quem mudou o quê, e quando. Nada aqui pode ser apagado.">Auditoria</Titulo>
      <div className="mb-4 grid gap-3 sm:max-w-[520px] sm:grid-cols-2">
        <select aria-label="Quem" value={usuario} onChange={(e) => { setUsuario(e.target.value); setPagina(1) }} className={campoTexto}>
          <option value="">Todos os administradores</option>
          {usuarios.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select aria-label="O quê" value={acao} onChange={(e) => { setAcao(e.target.value); setPagina(1) }} className={campoTexto}>
          <option value="">Todas as ações</option>
          {Object.entries(ACOES).map(([id, rotulo]) => (
            <option key={id} value={id}>
              {rotulo}
            </option>
          ))}
        </select>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <p className="text-muted">Carregando...</p>}
      {dados && (
        <Cartao className="overflow-x-auto p-0">
          {dados.registros.length === 0 ? (
            <p className="p-5 text-muted">Nada registrado com esses filtros.</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Quando</th>
                  <th className="px-4 py-3 font-semibold">Quem</th>
                  <th className="px-4 py-3 font-semibold">O quê</th>
                  <th className="px-4 py-3 font-semibold">Antes → depois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {dados.registros.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{dataHora(r.criado_em)}</td>
                    <td className="px-4 py-3">{r.usuario}</td>
                    <td className="px-4 py-3">
                      {ACOES[r.acao] ?? r.acao}
                      {r.alvo && <code className="ml-2 rounded-md bg-base px-1.5 py-0.5 text-xs text-muted">{r.alvo}</code>}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.antes === null && r.depois === null ? '' : `${resumo(r.antes)} → ${resumo(r.depois)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Cartao>
      )}
      {dados && paginas > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" onClick={() => setPagina((p) => p - 1)} disabled={pagina <= 1}>
            Anteriores
          </Button>
          <span className="text-sm text-muted">
            Página {pagina} de {paginas}
          </span>
          <Button variant="outline" onClick={() => setPagina((p) => p + 1)} disabled={pagina >= paginas}>
            Mais antigos
          </Button>
        </div>
      )}
    </>
  )
}
