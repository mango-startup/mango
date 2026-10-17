import { useEffect, useState } from 'react'
import { Botao } from '../../components/Botao'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type SaudeAdmin } from '../../lib/admin.ts'
import { Aviso, Cartao, Titulo } from './ui'
import { dataHora } from './util'

function Indicador({ rotulo, valor, alerta, detalhe }: { rotulo: string; valor: string | number; alerta?: boolean; detalhe?: string }) {
  return (
    <Cartao className={alerta ? 'border-danger/60' : ''}>
      <p className="text-sm text-muted">{rotulo}</p>
      <p className="mt-1 font-display text-[34px] leading-none tabular-nums">{valor}</p>
      <p className={`mt-2 text-[13px] ${alerta ? 'text-danger-ink' : 'text-muted'}`}>{alerta ? 'Precisa de atenção. ' : ''}{detalhe}</p>
    </Cartao>
  )
}

export function Saude() {
  const [dados, setDados] = useState<SaudeAdmin | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    admin
      .saude()
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [versao])

  return (
    <>
      <Titulo detalhe="Sinais de que algo está parado ou fora do esperado. Atualize a página para medir de novo.">Saúde</Titulo>
      <div className="mb-4">
        <Botao variante="secundario" onClick={() => setVersao((v) => v + 1)}>
          Atualizar
        </Botao>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <p className="text-muted">Carregando...</p>}
      {dados && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Indicador rotulo="Banco de dados" valor={dados.banco.ok ? 'OK' : 'Fora'} detalhe={`Respondeu em ${dados.banco.latencia_ms} ms`} alerta={!dados.banco.ok} />
          <Indicador
            rotulo="Fotos na fila de limpeza"
            valor={dados.fotos_aguardando_limpeza}
            alerta={dados.fotos_aguardando_limpeza_ha_mais_de_2_dias > 0}
            detalhe={`${dados.fotos_aguardando_limpeza_ha_mais_de_2_dias} esperando há mais de 2 dias`}
          />
          <Indicador rotulo="Pagamentos sem evento" valor={dados.pagamentos_aprovados_sem_evento} alerta={dados.pagamentos_aprovados_sem_evento > 0} detalhe="Dinheiro recebido por evento apagado: estornar à mão" />
          <Indicador
            rotulo="Pedidos de remoção parados"
            valor={dados.pedidos_de_remocao_pendentes_ha_mais_de_2_dias}
            alerta={dados.pedidos_de_remocao_pendentes_ha_mais_de_2_dias > 0}
            detalhe="Pendentes há mais de 2 dias"
          />
          <Indicador rotulo="Último aviso do Stripe" valor={dados.ultimo_webhook_do_stripe_em ? dataHora(dados.ultimo_webhook_do_stripe_em) : 'Nunca'} detalhe="Webhook de pagamento" />
        </div>
      )}
    </>
  )
}
