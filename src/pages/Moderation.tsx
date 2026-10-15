import { useParams } from 'react-router-dom'
import { PaginaProvisoria } from '../components/PaginaProvisoria'

export function ModerationPage() {
  const { id = '' } = useParams()
  return (
    <PaginaProvisoria
      titulo="Moderar fotos"
      descricao="Ver e apagar fotos, inclusive antes da revelação, e responder aos pedidos de remoção dos convidados."
      issue={17}
      links={[{ para: `/eventos/${id}`, rotulo: 'Voltar ao painel' }]}
    />
  )
}
