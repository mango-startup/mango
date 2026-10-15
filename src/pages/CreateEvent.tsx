import { PaginaProvisoria } from '../components/PaginaProvisoria'

export function CreateEventPage() {
  return (
    <PaginaProvisoria
      titulo="Nova câmera"
      descricao="Nome, data, horário da câmera, poses por convidado, revelação e pacote, numa página só. Pacote grátis cria direto; pago segue para o pagamento."
      issue={13}
      links={[
        { para: '/eventos/exemplo-pagamento/pagamento', rotulo: 'Exemplo: confirmação de pagamento' },
        { para: '/eventos', rotulo: 'Meus eventos' },
      ]}
    />
  )
}
