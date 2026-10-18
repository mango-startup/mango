import { useEffect, useState } from 'react'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarBytes, type Armazenamento, type Retencao } from '../../lib/admin.ts'
import { Colunas } from './Grafico'
import { Indicador } from './Indicador'
import { Aviso, Carregando, Cartao, Titulo } from './ui'
import { decimal, porcento } from './util'

export function Uso() {
  const [dados, setDados] = useState<{ arm: Armazenamento; ret: Retencao } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    Promise.all([admin.armazenamento(), admin.retencao()])
      .then(([arm, ret]) => ativo && setDados({ arm, ret }))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [])

  return (
    <>
      <Titulo detalhe="Quanto espaço as fotos ocupam e quantos anfitriões voltam para um segundo evento.">Uso e retenção</Titulo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <Carregando />}
      {dados && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador rotulo="Armazenamento total" valor={formatarBytes(dados.arm.total_bytes)} detalhe="Fotos que ainda estão no servidor" />
            <Indicador rotulo="Média por evento" valor={formatarBytes(dados.arm.bytes_por_evento)} detalhe="Eventos com ao menos uma foto" />
            <Indicador rotulo="Crescimento por semana" valor={formatarBytes(dados.arm.bytes_por_semana_recente)} detalhe="Média das últimas 4 semanas" />
            <Indicador
              rotulo="Anfitriões que voltam"
              valor={porcento(dados.ret.taxa_recorrencia)}
              detalhe={`${dados.ret.recorrentes} de ${dados.ret.anfitrioes}${dados.ret.dias_medios_entre_eventos === null ? '' : ` · um novo evento a cada ${decimal(dados.ret.dias_medios_entre_eventos)} dias`}`}
            />
          </div>
          <Cartao>
            <h2 className="mb-3 text-sm font-semibold">Armazenamento enviado por semana (12 semanas)</h2>
            {dados.arm.semanas.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma foto enviada no período.</p>
            ) : (
              <Colunas itens={dados.arm.semanas.map((s) => ({ rotulo: `Semana de ${s.semana.slice(8)}/${s.semana.slice(5, 7)}`, valor: s.bytes }))} formatar={formatarBytes} />
            )}
          </Cartao>
        </div>
      )}
    </>
  )
}
