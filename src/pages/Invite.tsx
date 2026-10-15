import { useParams } from 'react-router-dom'
import { PaginaProvisoria } from '../components/PaginaProvisoria'

// Uma rota para todo o caminho do convidado: boas-vindas, câmera, espera, revelação e álbum.
export function InvitePage() {
  const { codigo = '' } = useParams()
  return (
    <PaginaProvisoria
      titulo="Convite"
      descricao={`Evento ${codigo.toUpperCase()}. Esta rota muda conforme o estado do evento: boas-vindas, câmera, espera, revelação e álbum.`}
      issue={18}
      links={[
        { para: '/c/ABERTA27', rotulo: 'Exemplo: câmera aberta' },
        { para: '/c/ENCERRAD', rotulo: 'Exemplo: aguardando revelação' },
        { para: '/c/REVPHT24', rotulo: 'Exemplo: álbum revelado' },
        { para: `/c/${codigo}/f/exemplo-revelado-foto-1`, rotulo: 'Foto ampliada' },
      ]}
    />
  )
}
