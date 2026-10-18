import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { admin } from '../../lib/admin.ts'
import { Icone } from './Menu'
import { rotuloEmail } from './util'

interface Resultado {
  chave: string
  rotulo: string
  detalhe: string
  para: string
}

const PAGINAS: Resultado[] = [
  ['Resumo', '/admin'], ['Análise', '/admin/analise'], ['Crescimento', '/admin/crescimento'], ['Uso e retenção', '/admin/uso'], ['Ao vivo', '/admin/ao-vivo'], ['Eventos', '/admin/eventos'], ['Anfitriões', '/admin/anfitrioes'],
  ['Moderação', '/admin/moderacao'], ['Pagamentos', '/admin/pagamentos'], ['Pacotes', '/admin/pacotes'], ['Configurações', '/admin/configuracoes'],
  ['Saúde', '/admin/saude'], ['Auditoria', '/admin/auditoria'], ['Administradores', '/admin/administradores'],
].map(([rotulo, para]) => ({ chave: para, rotulo, detalhe: 'Ir para a tela', para }))

// Ctrl+K / ⌘K abre de qualquer tela do admin: acha telas, eventos (nome ou e-mail do anfitrião) e anfitriões.
export function BuscaGlobal({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const navegar = useNavigate()
  const [texto, setTexto] = useState('')
  const [remotos, setRemotos] = useState<Resultado[]>([])
  const [ativo, setAtivo] = useState(0)
  const campo = useRef<HTMLInputElement>(null)

  // Cada abertura começa limpa (o estado do componente sobrevive ao fechar).
  useEffect(() => {
    if (!aberta) return
    setTexto('')
    setRemotos([])
    setAtivo(0)
    campo.current?.focus()
  }, [aberta])

  const termo = texto.trim()
  useEffect(() => {
    if (termo.length < 2) return
    let vivo = true
    const t = setTimeout(() => {
      Promise.all([admin.eventos({ busca: termo }, 1).catch(() => null), admin.anfitrioes(termo, 1).catch(() => null)]).then(([ev, an]) => {
        if (!vivo) return
        setRemotos([
          ...(ev?.eventos.slice(0, 6).map((e) => ({ chave: `e${e.id}`, rotulo: e.nome, detalhe: `Evento · ${rotuloEmail(e.anfitriao_email)}`, para: `/admin/eventos/${e.id}` })) ?? []),
          ...(an?.anfitrioes.slice(0, 4).map((a) => ({ chave: `a${a.anfitriao_email}`, rotulo: a.anfitriao_email ?? 'Sem e-mail', detalhe: `Anfitrião · ${a.eventos} evento(s)`, para: `/admin/eventos?busca=${encodeURIComponent(a.anfitriao_email ?? '')}` })) ?? []),
        ])
      })
    }, 250)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [termo])

  if (!aberta) return null
  const paginas = PAGINAS.filter((p) => p.rotulo.toLowerCase().includes(termo.toLowerCase()))
  const lista = termo.length < 2 ? paginas : [...remotos, ...paginas]

  const ir = (r: Resultado) => {
    aoFechar()
    setTexto('')
    setRemotos([])
    navegar(r.para)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh]" onMouseDown={aoFechar}>
      <div role="dialog" aria-modal="true" aria-label="Busca" className="w-full max-w-[560px] overflow-hidden rounded-[20px] border border-line bg-base shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={campo}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setAtivo(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') aoFechar()
            else if (e.key === 'ArrowDown') (e.preventDefault(), setAtivo((a) => Math.min(a + 1, lista.length - 1)))
            else if (e.key === 'ArrowUp') (e.preventDefault(), setAtivo((a) => Math.max(a - 1, 0)))
            else if (e.key === 'Enter' && lista[ativo]) ir(lista[ativo])
          }}
          placeholder="Buscar evento, e-mail do anfitrião ou tela"
          aria-label="Buscar"
          className="h-14 w-full border-b border-line bg-transparent px-5 text-[16px] text-paper outline-none placeholder:text-muted/60"
        />
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {lista.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nada encontrado.</li>}
          {lista.map((r, i) => (
            <li key={r.chave}>
              <button type="button" onClick={() => ir(r)} onMouseEnter={() => setAtivo(i)} className={`flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 text-left ${i === ativo ? 'bg-surface' : ''}`}>
                <span className="truncate text-[15px]">{r.rotulo}</span>
                <span className="shrink-0 text-xs text-muted">{r.detalhe}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function BotaoBusca({ aoAbrir }: { aoAbrir: () => void }) {
  return (
    <button type="button" onClick={aoAbrir} aria-label="Buscar" className="flex h-10 w-full items-center gap-2 rounded-[12px] border border-line bg-surface/60 px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 text-sm text-muted hover:text-paper">
      <Icone nome="analise" className="size-4" />
      <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Buscar</span>
      <kbd className="hidden rounded border border-line px-1.5 text-[11px] md:inline group-data-[collapsible=icon]:hidden">Ctrl K</kbd>
    </button>
  )
}
