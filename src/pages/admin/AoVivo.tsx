import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type AoVivo as Dados } from '../../lib/admin.ts'
import { Aviso, Cartao, Carregando, EstadoVazio, Titulo } from './ui'
import { dataHora, rotuloEmail } from './util'

// Atualiza sozinho a cada 30 s enquanto a aba está aberta.
export function AoVivo() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    const buscar = () =>
      admin
        .aoVivo()
        .then((r) => ativo && (setDados(r), setErro(null)))
        .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    void buscar()
    const t = setInterval(() => void buscar(), 30_000)
    return () => {
      ativo = false
      clearInterval(t)
    }
  }, [])

  return (
    <>
      <Titulo detalhe="Eventos com a câmera aberta agora, do mais movimentado para o menos. Atualiza a cada 30 segundos.">Ao vivo</Titulo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <Carregando />}
      {dados && (
        <Cartao className="overflow-x-auto p-0">
          {dados.eventos.length === 0 ? (
            <EstadoVazio>Nenhum evento com a câmera aberta agora.</EstadoVazio>
          ) : (
            <table className="tabela-cards w-full text-left text-[14px] sm:min-w-[720px]">
              <thead className="sticky top-0 border-b border-line bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Evento</th>
                  <th className="px-4 py-3 font-semibold">Anfitrião</th>
                  <th className="px-4 py-3 text-right font-semibold">Convidados</th>
                  <th className="px-4 py-3 text-right font-semibold">Fotos</th>
                  <th className="px-4 py-3 text-right font-semibold">Na última hora</th>
                  <th className="px-4 py-3 font-semibold">Câmera fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line [&_tr:hover]:bg-surface/70">
                {dados.eventos.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      <Link to={`/admin/eventos/${e.id}`} className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-muted">
                        {e.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{rotuloEmail(e.anfitriao_email)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {e.convidados}
                      <span className="text-muted"> / {e.limite_convidados}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{e.fotos}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{e.fotos_ultima_hora}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{dataHora(e.captura_fim)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Cartao>
      )}
    </>
  )
}
