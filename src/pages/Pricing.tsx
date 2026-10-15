import { PaginaProvisoria } from '../components/PaginaProvisoria'

export function PricingPage() {
  return (
    <PaginaProvisoria
      titulo="Preços"
      descricao="Pacotes por número de convidados, com o que cada um inclui. Escolher um pacote abre a criação do evento."
      issue={11}
      links={[{ para: '/criar', rotulo: 'Criar uma câmera' }]}
    />
  )
}
