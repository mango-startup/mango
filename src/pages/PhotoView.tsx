import { useParams } from 'react-router-dom'
import { PaginaProvisoria } from '../components/PaginaProvisoria'

export function PhotoViewPage() {
  const { codigo = '' } = useParams()
  return (
    <PaginaProvisoria
      titulo="Foto"
      descricao="Foto ampliada com anterior e próxima, baixar, compartilhar e pedir remoção."
      issue={23}
      links={[{ para: `/c/${codigo}`, rotulo: 'Voltar ao álbum' }]}
    />
  )
}
