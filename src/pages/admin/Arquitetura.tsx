import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Cartao, Carregando, EstadoVazio, Titulo } from './ui'

// Mapa do código gerado pelo /understand (arquitetura-grafo.json). Para atualizar: rodar /understand e regerar o JSON.

interface No { id: string; t: string; n: string; p?: string; s: string; g: string[]; c?: string }
interface Camada { id: string; name: string; description: string; nodeIds: string[] }
interface Passo { order: number; title: string; description: string; nodeIds: string[] }
interface Grafo { gerado: string; commit: string; layers: Camada[]; tour: Passo[]; nodes: No[]; edges: [string, string, string][] }

const NIVEIS_ARQUIVO = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint'])
const CORES = ['#e8a33d', '#5aa9e6', '#7bc47f', '#d96c6c', '#b58be0', '#4fc1b8', '#d98fb5', '#9aa5b1']
const ROTULO_REL: Record<string, string> = {
  imports: 'Importa', imported_by: 'Importado por', contains: 'Contém', exports: 'Exporta', tested_by: 'Testado por',
  depends_on: 'Depende de', configures: 'Configura', deploys: 'Publica', triggers: 'Dispara', migrates: 'Migra',
  documents: 'Documenta', related: 'Relacionado', defines_schema: 'Define schema', implements: 'Implementa',
}

export function Arquitetura() {
  const [grafo, setGrafo] = useState<Grafo | null>(null)
  const [busca, setBusca] = useState('')
  const [camada, setCamada] = useState<string | null>(null)
  const [aba, setAba] = useState<'mapa' | 'tour'>('mapa')
  const [sel, setSel] = useState<string | null>(null)

  useEffect(() => {
    import('./arquitetura-grafo.json').then((m) => setGrafo(m.default as unknown as Grafo))
  }, [])

  const idx = useMemo(() => {
    if (!grafo) return null
    const porId = new Map(grafo.nodes.map((n) => [n.id, n]))
    const camadaDe = new Map<string, number>()
    grafo.layers.forEach((l, i) => l.nodeIds.forEach((id) => camadaDe.set(id, i)))
    const rel = new Map<string, [string, string][]>()
    const add = (a: string, b: string, k: string) => rel.set(a, [...(rel.get(a) ?? []), [k, b]])
    for (const [a, b, t] of grafo.edges) {
      add(a, b, t)
      if (t === 'imports') add(b, a, 'imported_by')
      else if (t === 'tested_by') add(b, a, 'testa')
    }
    const arquivos = grafo.nodes.filter((n) => NIVEIS_ARQUIVO.has(n.t))
    return { porId, camadaDe, rel, arquivos }
  }, [grafo])

  const lista = useMemo(() => {
    if (!grafo || !idx) return []
    const q = busca.trim().toLowerCase()
    return idx.arquivos.filter((n) => {
      if (camada && grafo.layers[idx.camadaDe.get(n.id) ?? -1]?.id !== camada) return false
      if (!q) return true
      return `${n.p ?? n.n} ${n.s} ${n.g.join(' ')}`.toLowerCase().includes(q)
    })
  }, [grafo, idx, busca, camada])

  if (!grafo || !idx) return (<><Titulo>Arquitetura</Titulo><Carregando /></>)

  const no = sel ? idx.porId.get(sel) : null
  const cor = (id: string) => CORES[(idx.camadaDe.get(id) ?? 7) % CORES.length]
  const abrir = (id: string) => { setSel(id); setAba('mapa') }
  const simbolos = no ? (idx.rel.get(no.id) ?? []).filter(([k]) => k === 'contains').map(([, id]) => idx.porId.get(id)).filter((x): x is No => !!x) : []
  const grupos: [string, [string, string][]][] = []
  if (no) for (const par of idx.rel.get(no.id) ?? []) {
    if (par[0] === 'contains') continue
    const g = grupos.find(([k]) => k === par[0])
    if (g) g[1].push(par); else grupos.push([par[0], [par]])
  }

  return (
    <>
      <Titulo detalhe={`Mapa do código gerado pelo /understand (commit ${grafo.commit.slice(0, 7)}, ${new Date(grafo.gerado).toLocaleDateString('pt-BR')}). Busque arquivos, filtre por camada e navegue pelas relações.`}>Arquitetura</Titulo>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Arquivos', idx.arquivos.length], ['Funções e classes', grafo.nodes.length - idx.arquivos.length], ['Relações', grafo.edges.length], ['Camadas', grafo.layers.length]].map(([r, v]) => (
          <Cartao key={r}><p className="text-[13px] text-muted">{r}</p><p className="font-display text-[28px] leading-none">{v}</p></Cartao>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {(['mapa', 'tour'] as const).map((a) => (
          <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
            className={`rounded-full border px-4 py-1.5 text-[14px] ${aba === a ? 'border-paper bg-paper text-base' : 'border-line text-muted'}`}>{a === 'mapa' ? 'Mapa' : 'Tour guiado'}</button>
        ))}
      </div>

      {aba === 'tour' ? (
        <ol className="space-y-3">
          {grafo.tour.map((p) => (
            <Cartao key={p.order}>
              <h2 className="text-[17px]"><span className="mr-2 text-muted">{p.order}.</span>{p.title}</h2>
              <p className="mt-1 text-[15px] text-muted">{p.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.nodeIds.map((id) => (
                  <button key={id} onClick={() => abrir(id)} className="rounded-full border border-line px-3 py-1 text-[13px] hover:border-paper">{idx.porId.get(id)?.n ?? id}</button>
                ))}
              </div>
            </Cartao>
          ))}
        </ol>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar arquivo, assunto ou tag…" className="max-w-[360px]" aria-label="Buscar" />
            <button onClick={() => setCamada(null)} className={`rounded-full border px-3 py-1 text-[13px] ${!camada ? 'border-paper' : 'border-line text-muted'}`}>Todas</button>
            {grafo.layers.map((l, i) => (
              <button key={l.id} title={l.description} onClick={() => setCamada(camada === l.id ? null : l.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] ${camada === l.id ? 'border-paper' : 'border-line text-muted'}`}>
                <span aria-hidden className="size-2 rounded-full" style={{ background: CORES[i % CORES.length] }} />{l.name}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Cartao className="max-h-[70vh] overflow-auto !p-2">
              {lista.length === 0 ? <EstadoVazio>Nada encontrado com esse filtro.</EstadoVazio> : (
                <ul>
                  {lista.map((n) => (
                    <li key={n.id}>
                      <button onClick={() => setSel(n.id)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface ${sel === n.id ? 'bg-surface' : ''}`}>
                        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: cor(n.id) }} />
                        <span className="min-w-0"><span className="block truncate text-[14px]">{n.p ?? n.n}</span><span className="line-clamp-1 text-[13px] text-muted">{n.s}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="px-3 py-2 text-[12px] text-muted">{lista.length} de {idx.arquivos.length} arquivos</p>
            </Cartao>

            <Cartao className="max-h-[70vh] overflow-auto">
              {!no ? <EstadoVazio>Escolha um arquivo para ver o resumo e as relações.</EstadoVazio> : (
                <div className="space-y-4">
                  <div>
                    <p className="break-all text-[15px]">{no.p ?? no.n}</p>
                    <p className="mt-1 text-[12px] text-muted">{grafo.layers[idx.camadaDe.get(no.id) ?? -1]?.name ?? '—'} · {no.t}{no.c ? ` · ${no.c}` : ''}</p>
                    <p className="mt-2 text-[15px] leading-normal">{no.s}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">{no.g.map((t) => <button key={t} onClick={() => setBusca(t)} className="rounded-full border border-line px-2 py-0.5 text-[12px] text-muted">{t}</button>)}</div>
                  </div>
                  {simbolos.length > 0 && (
                    <div>
                      <h3 className="mb-1 text-[13px] text-muted">Contém ({simbolos.length})</h3>
                      <ul className="space-y-1">{simbolos.map((s) => <li key={s.id} className="text-[13px]"><span className="text-muted">{s.t} </span>{s.n}<span className="text-muted"> — {s.s}</span></li>)}</ul>
                    </div>
                  )}
                  {grupos.map(([k, itens]) => (
                    <div key={k}>
                      <h3 className="mb-1 text-[13px] text-muted">{ROTULO_REL[k] ?? (k === 'testa' ? 'Testa' : k)} ({itens?.length})</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {itens?.map(([, id]) => <button key={id} onClick={() => abrir(id)} className="rounded-full border border-line px-2.5 py-0.5 text-[13px] hover:border-paper">{idx.porId.get(id)?.p ?? idx.porId.get(id)?.n ?? id}</button>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Cartao>
          </div>
        </>
      )}
    </>
  )
}
