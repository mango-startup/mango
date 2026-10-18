import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, errosDeCampo, type GrupoConfig, type ItemConfig, type ValorConfig } from '../../lib/admin.ts'
import {Aviso, Cartao, Interruptor, Titulo} from './ui'
import { Input } from '@/components/ui/input'
import { dataHora } from './util'

type Rascunho = string | boolean

/** O valor como aparece no campo de edição. */
function paraCampo(item: ItemConfig, valor: ValorConfig): Rascunho {
  if (item.tipo === 'booleano') return Boolean(valor)
  if (item.tipo === 'lista_inteiros') return (valor as number[]).join(', ')
  return String(valor).replace('.', item.tipo === 'decimal' ? ',' : '.')
}

/** Do campo para o valor que o servidor espera. Devolve a mensagem se a digitação não faz sentido. */
function doCampo(item: ItemConfig, campo: Rascunho): { ok: true; valor: ValorConfig } | { ok: false; mensagem: string } {
  switch (item.tipo) {
    case 'booleano':
      return { ok: true, valor: Boolean(campo) }
    case 'texto':
      return { ok: true, valor: String(campo).trim() }
    case 'inteiro': {
      const t = String(campo).trim()
      return /^-?\d+$/.test(t) ? { ok: true, valor: Number(t) } : { ok: false, mensagem: 'Informe um número inteiro.' }
    }
    case 'decimal': {
      const t = String(campo).trim().replace(',', '.')
      return /^-?\d+(\.\d+)?$/.test(t) ? { ok: true, valor: Number(t) } : { ok: false, mensagem: 'Informe um número, por exemplo 0,8.' }
    }
    case 'lista_inteiros': {
      const partes = String(campo).split(/[\s,;]+/).filter(Boolean)
      if (partes.length === 0 || !partes.every((x) => /^\d+$/.test(x))) return { ok: false, mensagem: 'Informe números inteiros separados por vírgula, por exemplo 12, 24, 36.' }
      return { ok: true, valor: partes.map(Number) }
    }
  }
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function rotuloPadrao(item: ItemConfig): string {
  if (item.tipo === 'booleano') return item.padrao ? 'ligado' : 'desligado'
  if (item.tipo === 'lista_inteiros') return (item.padrao as number[]).join(', ')
  if (item.padrao === '') return 'vazio'
  return `${String(item.padrao).replace('.', ',')}${item.unidade ? ' ' + item.unidade : ''}`
}

export function Configuracoes() {
  const [grupos, setGrupos] = useState<GrupoConfig[] | null>(null)
  const [campos, setCampos] = useState<Record<string, Rascunho>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [geral, setGeral] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // Mudar `versao` recarrega tudo do servidor (depois de salvar ou voltar ao padrão).
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    admin
      .configuracoes()
      .then((g) => {
        if (!ativo) return
        setGrupos(g)
        setCampos(Object.fromEntries(g.flatMap((x) => x.itens).map((i) => [i.chave, paraCampo(i, i.valor)])))
        setGeral(null)
      })
      .catch((e: unknown) => ativo && setGeral(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [versao])

  const itens = useMemo(() => (grupos ?? []).flatMap((g) => g.itens), [grupos])
  const alterados = useMemo(() => itens.filter((i) => campos[i.chave] !== undefined && !igual(campos[i.chave], paraCampo(i, i.valor))), [itens, campos])

  /** Lista no aviso quais campos têm problema e leva a tela até o primeiro (o aviso fica no topo, o campo pode estar longe). */
  function apontarErros(deCampo: Record<string, string>) {
    const chaves = Object.keys(deCampo)
    const nomes = chaves.map((k) => itens.find((i) => i.chave === k)?.rotulo ?? k)
    setGeral(`Nada foi salvo. Confira: ${nomes.join('; ')}.`)
    const primeiro = chaves.find((k) => document.getElementById(`cfg-${k}`))
    if (primeiro) {
      setTimeout(() => {
        const el = document.getElementById(`cfg-${primeiro}`)
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el?.focus({ preventScroll: true })
      }, 50)
    }
  }

  function mostrarSalvo() {
    setSalvo(true)
    setTimeout(() => setSalvo(false), 4000)
  }

  async function enviar(mudancas: Record<string, ValorConfig | null>) {
    setEnviando(true)
    setErros({})
    setGeral(null)
    try {
      await admin.salvarConfiguracoes(mudancas)
      setVersao((v) => v + 1)
      mostrarSalvo()
    } catch (e) {
      const deCampo = errosDeCampo(e)
      setErros(deCampo)
      if (Object.keys(deCampo).length === 0) setGeral(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.')
      else apontarErros(deCampo)
    } finally {
      setEnviando(false)
    }
  }

  async function salvar() {
    const mudancas: Record<string, ValorConfig> = {}
    const locais: Record<string, string> = {}
    for (const item of alterados) {
      const lido = doCampo(item, campos[item.chave])
      if (lido.ok) mudancas[item.chave] = lido.valor
      else locais[item.chave] = lido.mensagem
    }
    if (Object.keys(locais).length) {
      setErros(locais)
      return apontarErros(locais)
    }
    await enviar(mudancas)
  }

  return (
    <>
      <Titulo detalhe="Valores de negócio e limites do site. Cada mudança vale na hora (em até 10 segundos), é validada pelo servidor e fica registrada na auditoria. Salvar aplica tudo ou nada.">Configurações</Titulo>
      {geral && <Aviso tipo="erro">{geral}</Aviso>}
      {salvo && <Aviso tipo="ok">Salvo. Já vale no site.</Aviso>}
      {!grupos && !geral && <p className="text-muted">Carregando...</p>}
      <div className="flex flex-col gap-6 pb-28">
        {grupos?.map((grupo) => (
          <Cartao key={grupo.nome}>
            <h2 className="mb-1 font-display text-[24px] leading-none">{grupo.nome}</h2>
            <ul className="divide-y divide-line">
              {grupo.itens.map((item) => {
                const campo = campos[item.chave]
                const mudou = alterados.some((a) => a.chave === item.chave)
                const idCampo = `cfg-${item.chave}`
                return (
                  <li key={item.chave} className="grid gap-3 py-5 lg:grid-cols-[1fr_300px] lg:gap-8">
                    <div>
                      <label htmlFor={idCampo} className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                        {item.rotulo}
                        {item.personalizado && <span className="rounded-full border border-line px-2 py-0.5 text-xs font-normal text-muted">alterado</span>}
                        {mudou && <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-base">não salvo</span>}
                      </label>
                      <p className="mt-1 text-[14px] leading-normal text-muted">{item.descricao}</p>
                      <p className="mt-1 text-[13px] text-muted">
                        Padrão: {rotuloPadrao(item)}
                        {item.min !== null && ` · de ${item.min} a ${item.max}`}
                        {item.personalizado && item.atualizado_em && ` · alterado em ${dataHora(item.atualizado_em)}`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {item.tipo === 'booleano' ? (
                        <div className="flex min-h-11 items-center gap-3">
                          <Interruptor marcado={Boolean(campo)} onMudar={(v) => setCampos((c) => ({ ...c, [item.chave]: v }))} rotulo={item.rotulo} />
                          <span className="text-sm text-muted">{campo ? 'Ligado' : 'Desligado'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            id={idCampo}
                            value={String(campo ?? '')}
                            onChange={(e) => setCampos((c) => ({ ...c, [item.chave]: e.target.value }))}
                            inputMode={item.tipo === 'texto' ? 'text' : item.tipo === 'lista_inteiros' ? 'text' : 'decimal'}
                           
                            aria-describedby={erros[item.chave] ? `${idCampo}-erro` : undefined}
                          />
                          {item.unidade && <span className="shrink-0 text-sm text-muted">{item.unidade}</span>}
                        </div>
                      )}
                      {erros[item.chave] && (
                        <p id={`${idCampo}-erro`} role="alert" className="text-sm text-danger-ink">
                          {erros[item.chave]}
                        </p>
                      )}
                      {item.personalizado && (
                        <button type="button" disabled={enviando} onClick={() => void enviar({ [item.chave]: null })} className="self-start text-sm text-muted underline underline-offset-4 hover:text-paper disabled:opacity-40">
                          Voltar ao padrão
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Cartao>
        ))}
      </div>
      {alterados.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-base/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {alterados.length} alteraç{alterados.length === 1 ? 'ão' : 'ões'} sem salvar
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setCampos(Object.fromEntries(itens.map((i) => [i.chave, paraCampo(i, i.valor)])))} disabled={enviando}>
                Descartar
              </Button>
              <Button onClick={() => void salvar()} disabled={enviando}>
                {enviando ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
