import { useEffect, useState } from 'react'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarReais, type PaginaAnfitrioes } from '../../lib/admin.ts'
import { Paginacao } from './Paginacao'
import { Aviso, Cartao, Titulo } from './ui'
import { campoTexto, dataHora } from './util'

export function Anfitrioes() {
  const [busca, setBusca] = useState('')
  const [aplicada, setAplicada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [dados, setDados] = useState<PaginaAnfitrioes | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setAplicada(busca.trim())
      setPagina(1)
    }, 350)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    let ativo = true
    admin
      .anfitrioes(aplicada, pagina)
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [aplicada, pagina])

  return (
    <>
      <Titulo detalhe="Quem cria eventos no Mango, agrupado por e-mail: quantos eventos, quantas fotos e quanto já pagou.">Anfitriões</Titulo>
      <input type="search" aria-label="Buscar anfitrião" placeholder="Buscar por e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} className={`${campoTexto} mb-4 sm:max-w-[360px]`} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <p className="text-muted">Carregando...</p>}
      {dados && (
        <>
          <p className="mb-2 text-sm text-muted">{dados.total} {dados.total === 1 ? 'anfitrião' : 'anfitriões'}</p>
          <Cartao className="overflow-x-auto p-0">
            {dados.anfitrioes.length === 0 ? (
              <p className="p-5 text-muted">Nenhum anfitrião encontrado.</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-[14px]">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">E-mail</th>
                    <th className="px-4 py-3 text-right font-semibold">Eventos</th>
                    <th className="px-4 py-3 text-right font-semibold">Fotos</th>
                    <th className="px-4 py-3 text-right font-semibold">Pago</th>
                    <th className="px-4 py-3 font-semibold">Último evento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dados.anfitrioes.map((a) => (
                    <tr key={a.anfitriao_email}>
                      <td className="px-4 py-3">{a.anfitriao_email}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{a.eventos}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{a.fotos}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatarReais(a.pago_centavos)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{dataHora(a.ultimo_evento_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>
          <Paginacao pagina={dados.pagina} limite={dados.limite} total={dados.total} aoMudar={setPagina} />
        </>
      )}
    </>
  )
}
