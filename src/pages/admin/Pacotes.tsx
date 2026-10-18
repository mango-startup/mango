import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, centavosParaCampo, errosDeCampo, reaisParaCentavos, type EdicaoPacote, type NovoPacote, type PacoteAdmin } from '../../lib/admin.ts'
import { precoEmReais } from '../../lib/formato'
import {Aviso, Campo, Cartao, Interruptor, Titulo} from './ui'
import { Input } from '@/components/ui/input'

interface Formulario {
  id: string
  nome: string
  convidados: string
  preco: string
  retencao: string
  posesMax: string
  ordem: string
  ativo: boolean
}

const vazio: Formulario = { id: '', nome: '', convidados: '30', preco: '49,00', retencao: '365', posesMax: '36', ordem: '', ativo: true }

const doPacote = (p: PacoteAdmin): Formulario => ({
  id: p.id,
  nome: p.nome,
  convidados: String(p.convidados),
  preco: centavosParaCampo(p.preco_centavos),
  retencao: String(p.retencao_dias),
  posesMax: String(p.poses_max),
  ordem: String(p.ordem),
  ativo: p.ativo,
})

const inteiro = (t: string): number | null => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : null)

/** Converte o formulário em números; devolve os erros de digitação por campo. */
function ler(f: Formulario): { erros: Record<string, string>; dados: Omit<NovoPacote, 'id'> & { ordem?: number } } {
  const erros: Record<string, string> = {}
  const convidados = inteiro(f.convidados)
  const preco = reaisParaCentavos(f.preco)
  const retencao = inteiro(f.retencao)
  const posesMax = inteiro(f.posesMax)
  const ordem = f.ordem.trim() === '' ? undefined : inteiro(f.ordem)
  if (convidados === null) erros.convidados = 'Informe um número inteiro.'
  if (preco === null) erros.preco_centavos = 'Informe o preço em reais, por exemplo 49,90 (ou 0 para grátis).'
  if (retencao === null) erros.retencao_dias = 'Informe um número inteiro de dias.'
  if (posesMax === null) erros.poses_max = 'Informe um número inteiro.'
  if (ordem === null) erros.ordem = 'Informe um número inteiro.'
  return {
    erros,
    dados: { nome: f.nome.trim(), convidados: convidados ?? 0, preco_centavos: preco ?? 0, retencao_dias: retencao ?? 0, poses_max: posesMax ?? 0, ativo: f.ativo, ...(ordem !== undefined && ordem !== null ? { ordem } : {}) },
  }
}

function CamposDoPacote({ f, mudar, erros, protegido, novo }: { f: Formulario; mudar: (p: Partial<Formulario>) => void; erros: Record<string, string>; protegido?: boolean; novo?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {novo && (
        <Campo rotulo="Id" erro={erros.id} ajuda="Letras minúsculas, números e _. Não muda depois.">
          {(id) => <Input id={id} value={f.id} onChange={(e) => mudar({ id: e.target.value })} placeholder="vip" autoCapitalize="none" />}
        </Campo>
      )}
      <Campo rotulo="Nome" erro={erros.nome}>
        {(id) => <Input id={id} value={f.nome} onChange={(e) => mudar({ nome: e.target.value })} maxLength={40} />}
      </Campo>
      <Campo rotulo="Convidados" erro={erros.convidados} ajuda="Só vale para eventos novos.">
        {(id) => <Input id={id} inputMode="numeric" value={f.convidados} onChange={(e) => mudar({ convidados: e.target.value })} />}
      </Campo>
      <Campo rotulo="Preço (R$)" erro={erros.preco_centavos} ajuda={protegido ? 'O teste é sempre grátis.' : 'Só vale para a próxima compra. 0 = grátis.'}>
        {(id) => <Input id={id} inputMode="decimal" value={f.preco} onChange={(e) => mudar({ preco: e.target.value })} disabled={protegido} />}
      </Campo>
      <Campo rotulo="Álbum no ar (dias)" erro={erros.retencao_dias} ajuda="Depois da revelação. Só vale para eventos novos: os existentes mantêm o prazo prometido.">
        {(id) => <Input id={id} inputMode="numeric" value={f.retencao} onChange={(e) => mudar({ retencao: e.target.value })} />}
      </Campo>
      <Campo rotulo="Fotos por convidado (máximo)" erro={erros.poses_max} ajuda="Não passa da maior opção de fotos (aba Configurações).">
        {(id) => <Input id={id} inputMode="numeric" value={f.posesMax} onChange={(e) => mudar({ posesMax: e.target.value })} />}
      </Campo>
      <Campo rotulo="Ordem" erro={erros.ordem} ajuda="Posição na tela de preços (menor primeiro).">
        {(id) => <Input id={id} inputMode="numeric" value={f.ordem} onChange={(e) => mudar({ ordem: e.target.value })} placeholder={novo ? 'depois do último' : ''} />}
      </Campo>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Disponível para venda</span>
        <div className="flex min-h-11 items-center gap-3">
          <Interruptor marcado={f.ativo} onMudar={(ativo) => mudar({ ativo })} rotulo="Disponível para venda" desabilitado={protegido} />
          <span className="text-sm text-muted">{protegido ? 'O teste não pode ser desativado.' : f.ativo ? 'Aparece na tela de preços.' : 'Escondido; eventos existentes seguem.'}</span>
        </div>
        {erros.ativo && (
          <p role="alert" className="text-sm text-danger-ink">
            {erros.ativo}
          </p>
        )}
      </div>
    </div>
  )
}

function LinhaPacote({ p, aoSalvar }: { p: PacoteAdmin; aoSalvar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [f, setF] = useState<Formulario>(() => doPacote(p))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [geral, setGeral] = useState<string | null>(null)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const lido = ler(f)
    if (Object.keys(lido.erros).length) return setErros(lido.erros)
    const original = doPacote(p)
    const mudou: EdicaoPacote = {}
    if (f.nome.trim() !== original.nome) mudou.nome = lido.dados.nome
    if (f.convidados !== original.convidados) mudou.convidados = lido.dados.convidados
    if (f.preco !== original.preco) mudou.preco_centavos = lido.dados.preco_centavos
    if (f.retencao !== original.retencao) mudou.retencao_dias = lido.dados.retencao_dias
    if (f.posesMax !== original.posesMax) mudou.poses_max = lido.dados.poses_max
    if (f.ordem !== original.ordem && lido.dados.ordem !== undefined) mudou.ordem = lido.dados.ordem
    if (f.ativo !== original.ativo) mudou.ativo = f.ativo
    if (Object.keys(mudou).length === 0) return setAberto(false)
    setEnviando(true)
    setErros({})
    setGeral(null)
    try {
      await admin.editarPacote(p.id, mudou)
      setAberto(false)
      aoSalvar()
    } catch (err) {
      const deCampo = errosDeCampo(err)
      setErros(deCampo)
      if (Object.keys(deCampo).length === 0) setGeral(err instanceof ErroApi ? err.message : 'Sem conexão com o servidor.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Cartao>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-[18px] font-semibold">
            {p.nome}
            <code className="rounded-md bg-base px-2 py-0.5 text-xs font-normal text-muted">{p.id}</code>
            {!p.ativo && <span className="rounded-full border border-line px-2 py-0.5 text-xs font-normal text-muted">escondido</span>}
          </h2>
          <p className="mt-1 text-[15px] text-muted">
            {p.gratis ? 'Grátis' : precoEmReais(p.preco_centavos)} · até {p.convidados} convidados · até {p.poses_max} fotos · álbum por {p.retencao_dias} dias ·{' '}
            {p.eventos ?? 0} evento{(p.eventos ?? 0) === 1 ? '' : 's'}
          </p>
        </div>
        {!aberto && (
          <Button
            variant="outline"
            onClick={() => {
              setF(doPacote(p))
              setErros({})
              setAberto(true)
            }}
          >
            Editar
          </Button>
        )}
      </div>
      {aberto && (
        <form onSubmit={salvar} className="mt-5 flex flex-col gap-5 border-t border-line pt-5">
          <CamposDoPacote f={f} mudar={(parte) => setF((x) => ({ ...x, ...parte }))} erros={erros} protegido={p.id === 'teste'} />
          {geral && <Aviso tipo="erro">{geral}</Aviso>}
          <div className="flex gap-2">
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button variant="ghost" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Cartao>
  )
}

function NovoPacoteForm({ aoCriar, aoFechar }: { aoCriar: () => void; aoFechar: () => void }) {
  const [f, setF] = useState<Formulario>(vazio)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [geral, setGeral] = useState<string | null>(null)

  async function criar(e: FormEvent) {
    e.preventDefault()
    const lido = ler(f)
    if (Object.keys(lido.erros).length) return setErros(lido.erros)
    setEnviando(true)
    setErros({})
    setGeral(null)
    try {
      await admin.criarPacote({ id: f.id.trim(), ...lido.dados })
      aoCriar()
    } catch (err) {
      const deCampo = errosDeCampo(err)
      setErros(deCampo)
      if (Object.keys(deCampo).length === 0) setGeral(err instanceof ErroApi ? err.message : 'Sem conexão com o servidor.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Cartao>
      <h2 className="mb-4 text-[18px] font-semibold">Novo pacote</h2>
      <form onSubmit={criar} className="flex flex-col gap-5">
        <CamposDoPacote f={f} mudar={(parte) => setF((x) => ({ ...x, ...parte }))} erros={erros} novo />
        {geral && <Aviso tipo="erro">{geral}</Aviso>}
        <div className="flex gap-2">
          <Button type="submit" disabled={enviando}>
            {enviando ? 'Criando...' : 'Criar pacote'}
          </Button>
          <Button variant="ghost" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
        </div>
      </form>
    </Cartao>
  )
}

export function Pacotes() {
  const [lista, setLista] = useState<PacoteAdmin[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  // Mudar `versao` recarrega a lista (depois de salvar).
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    admin
      .pacotes()
      .then((l) => ativo && (setLista(l), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [versao])

  function depoisDeSalvar() {
    setSalvo(true)
    setCriando(false)
    setVersao((v) => v + 1)
    setTimeout(() => setSalvo(false), 4000)
  }

  return (
    <>
      <Titulo detalhe="Planos à venda. Mudar preço, convidados ou prazo vale para os eventos novos: quem já criou um evento mantém o que foi prometido. Os pacotes pagos só abrem quando o pagamento estiver ligado (aba Configurações).">Pacotes</Titulo>
      <div className="flex flex-col gap-4">
        {salvo && <Aviso tipo="ok">Salvo. Já vale no site.</Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {!lista && !erro && <p className="text-muted">Carregando...</p>}
        {lista?.map((p) => (
          <LinhaPacote key={`${p.id}-${p.nome}-${p.preco_centavos}-${p.convidados}-${p.retencao_dias}-${p.poses_max}-${p.ativo}-${p.ordem}`} p={p} aoSalvar={depoisDeSalvar} />
        ))}
        {lista && (criando ? <NovoPacoteForm aoCriar={depoisDeSalvar} aoFechar={() => setCriando(false)} /> : <Button variant="outline" onClick={() => setCriando(true)} className="self-start">Novo pacote</Button>)}
      </div>
    </>
  )
}
