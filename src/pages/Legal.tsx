import { PaginaProvisoria } from '../components/PaginaProvisoria'

const rodape = [
  { para: '/termos', rotulo: 'Termos de uso' },
  { para: '/privacidade', rotulo: 'Privacidade' },
  { para: '/ajuda', rotulo: 'Ajuda' },
]

export function TermsPage() {
  return <PaginaProvisoria titulo="Termos de uso" descricao="Regras de uso do Mango. Texto final depende de revisão jurídica." issue={24} links={rodape} />
}

export function PrivacyPage() {
  return <PaginaProvisoria titulo="Privacidade" descricao="Como o Mango trata fotos e dados pessoais. Texto final depende de revisão jurídica." issue={24} links={rodape} />
}

export function HelpPage() {
  return <PaginaProvisoria titulo="Ajuda" descricao="Perguntas frequentes e contato." issue={24} links={rodape} />
}
