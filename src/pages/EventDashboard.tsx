import { useParams } from 'react-router-dom'
import { PaginaProvisoria } from '../components/PaginaProvisoria'

export function EventDashboardPage() {
  const { id = '' } = useParams()
  return (
    <PaginaProvisoria
      titulo="Painel do evento"
      descricao={`Ficha do evento ${id}: link e QR do convidado, contagem, encerrar, revelar, privacidade, baixar tudo e excluir.`}
      issue={16}
      links={[
        { para: `/eventos/${id}/moderacao`, rotulo: 'Moderar fotos' },
        { para: `/eventos/${id}/pagamento`, rotulo: 'Pagamento' },
        { para: '/eventos', rotulo: 'Meus eventos' },
      ]}
    />
  )
}
