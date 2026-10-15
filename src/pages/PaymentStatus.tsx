import { useParams } from 'react-router-dom'
import { PaginaProvisoria } from '../components/PaginaProvisoria'

export function PaymentStatusPage() {
  const { id = '' } = useParams()
  return (
    <PaginaProvisoria
      titulo="Pagamento"
      descricao="Confirmando, aprovado, pendente, recusado ou demorando, cada um com a próxima ação. O evento só fica pronto com o pagamento aprovado."
      issue={14}
      links={[{ para: `/eventos/${id}`, rotulo: 'Voltar ao painel' }]}
    />
  )
}
