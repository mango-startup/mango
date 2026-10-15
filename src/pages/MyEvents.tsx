import { PaginaProvisoria } from '../components/PaginaProvisoria'

export function MyEventsPage() {
  return (
    <PaginaProvisoria
      titulo="Meus eventos"
      descricao="Fichas dos eventos que você administra neste aparelho: nome, data, estado e a próxima ação."
      issue={15}
      links={[
        { para: '/eventos/exemplo-aberta', rotulo: 'Exemplo: Casamento da Ana e do Léo (câmera aberta)' },
        { para: '/eventos/exemplo-revelado', rotulo: 'Exemplo: Festa junina da rua (revelado)' },
        { para: '/criar', rotulo: 'Criar uma câmera' },
      ]}
    />
  )
}
