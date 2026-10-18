import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, urlMiniaturaAdmin, type FotoAlbumAdmin, type VistaAnfitriao } from '../../lib/admin.ts'
import { Aviso, Cartao, Carregando, EstadoVazio, Titulo } from './ui'
import { dataHora, ESTADOS_EVENTO } from './util'

// Só leitura: mostra o que o anfitrião vê, sem usar o link secreto dele e sem nenhum botão que mude algo.
export function ComoAnfitriao() {
  const { id = '' } = useParams()
  const [vista, setVista] = useState<VistaAnfitriao | null>(null)
  const [fotos, setFotos] = useState<FotoAlbumAdmin[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    admin
      .comoAnfitriao(id)
      .then((r) => ativo && setVista(r))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [id])

  useEffect(() => {
    let ativo = true
    admin
      .albumDoEvento(id, pagina)
      .then((r) => ativo && (setFotos((atual) => (pagina === 1 ? r.fotos : [...atual, ...r.fotos])), setTotal(r.total)))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [id, pagina])

  const e = vista?.evento
  return (
    <>
      <Link to={`/admin/eventos/${id}`} className="mb-4 inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-paper hover:underline">
        Voltar para o evento
      </Link>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!vista && !erro && <Carregando />}
      {vista && e && (
        <div className="flex flex-col gap-6">
          <Aviso tipo="ok">Modo leitura: você está vendo o painel como o anfitrião vê. Nada aqui altera o evento, e esta consulta fica registrada na auditoria.</Aviso>
          <Titulo detalhe={`${e.anfitriao_email ?? 'sem e-mail'} · ${ESTADOS_EVENTO[e.estado] ?? e.estado}`}>{e.nome}</Titulo>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Cartao>
              <p className="text-sm text-muted">Convidados</p>
              <p className="mt-1 font-display text-[34px] leading-none tabular-nums">
                {e.convidados}
                <span className="text-[18px] text-muted"> / {e.limite_convidados}</span>
              </p>
            </Cartao>
            <Cartao>
              <p className="text-sm text-muted">Fotos no álbum</p>
              <p className="mt-1 font-display text-[34px] leading-none tabular-nums">{e.fotos}</p>
            </Cartao>
            <Cartao>
              <p className="text-sm text-muted">Câmera</p>
              <p className="mt-2 text-[15px]">
                {dataHora(e.captura_inicio)} até {dataHora(e.captura_fim)}
              </p>
            </Cartao>
            <Cartao>
              <p className="text-sm text-muted">Revelação</p>
              <p className="mt-2 text-[15px]">{e.revelado_em ? `revelado em ${dataHora(e.revelado_em)}` : dataHora(e.revelacao_em)}</p>
              <p className="mt-1 text-[13px] text-muted">Álbum {e.album_privado ? 'privado' : 'aberto a quem tem o código'}</p>
            </Cartao>
          </div>

          <Cartao>
            <h2 className="mb-3 text-sm font-semibold">Pedidos de remoção pendentes ({vista.pedidos_de_remocao.length})</h2>
            {vista.pedidos_de_remocao.length === 0 ? (
              <p className="text-sm text-muted">Nenhum pedido pendente.</p>
            ) : (
              <ul className="divide-y divide-line text-[15px]">
                {vista.pedidos_de_remocao.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-x-4 py-2">
                    <span>
                      Foto {p.numero ?? '—'} <span className="text-muted">· {p.motivo || 'sem motivo'}</span>
                    </span>
                    <span className="text-muted">{dataHora(p.criado_em)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-sm font-semibold">Álbum ({total})</h2>
            {fotos.length === 0 ? (
              <EstadoVazio>Nenhuma foto neste evento ainda.</EstadoVazio>
            ) : (
              <>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {fotos.map((f) => (
                    <li key={f.id} className="relative aspect-square overflow-hidden rounded-[12px] border border-line bg-surface">
                      <img src={urlMiniaturaAdmin(id, f.id)} alt={`Foto ${f.numero}${f.apelido ? ` de ${f.apelido}` : ''}`} loading="lazy" className="size-full object-cover" />
                      <span className="absolute bottom-1 left-1 rounded bg-base/80 px-1.5 text-[11px] tabular-nums">{f.numero}</span>
                    </li>
                  ))}
                </ul>
                {fotos.length < total && (
                  <Button type="button" variant="outline" className="mt-4" onClick={() => setPagina((p) => p + 1)}>
                    Carregar mais
                  </Button>
                )}
              </>
            )}
          </Cartao>
        </div>
      )}
    </>
  )
}
