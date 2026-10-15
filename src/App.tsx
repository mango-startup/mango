import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { carregarConfig } from './lib/configPublica'
import { RequireHost } from './components/RequireHost'
import { Administradores } from './pages/admin/Administradores'
import { AdminLayout } from './pages/admin/AdminLayout'
import { Auditoria } from './pages/admin/Auditoria'
import { Configuracoes } from './pages/admin/Configuracoes'
import { Pacotes } from './pages/admin/Pacotes'
import { Resumo } from './pages/admin/Resumo'
import { TrocarSenha } from './pages/admin/TrocarSenha'
import { CreateEventPage } from './pages/CreateEvent'
import { EventDashboardPage } from './pages/EventDashboard'
import { HostLinkPage, HostSignInPage } from './pages/HostAccess'
import { InvitePage } from './pages/Invite'
import { LandingPage } from './pages/Landing'
import { HelpPage, PrivacyPage, TermsPage } from './pages/Legal'
import { ModerationPage } from './pages/Moderation'
import { MyEventsPage } from './pages/MyEvents'
import { NotFoundPage } from './pages/NotFound'
import { PaymentStatusPage } from './pages/PaymentStatus'
import { PhotoViewPage } from './pages/PhotoView'
import { PricingPage } from './pages/Pricing'

export default function App() {
  useEffect(() => {
    void carregarConfig()
  }, [])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/precos" element={<PricingPage />} />
        <Route path="/termos" element={<TermsPage />} />
        <Route path="/privacidade" element={<PrivacyPage />} />
        <Route path="/ajuda" element={<HelpPage />} />

        {/* Anfitrião: criar não exige acesso (o token nasce na criação) */}
        <Route path="/criar" element={<CreateEventPage />} />
        <Route path="/entrar" element={<HostSignInPage />} />
        <Route path="/anfitriao" element={<HostLinkPage />} />
        <Route path="/eventos" element={<MyEventsPage />} />
        <Route path="/eventos/:id" element={<RequireHost><EventDashboardPage /></RequireHost>} />
        <Route path="/eventos/:id/pagamento" element={<RequireHost><PaymentStatusPage /></RequireHost>} />
        <Route path="/eventos/:id/moderacao" element={<RequireHost><ModerationPage /></RequireHost>} />

        {/* Convidado: um link por evento */}
        <Route path="/c/:codigo" element={<InvitePage />} />
        <Route path="/c/:codigo/f/:foto" element={<PhotoViewPage />} />

        {/* Admin dos donos do Mango: fora da navegação do site e dos buscadores */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Resumo />} />
          <Route path="pacotes" element={<Pacotes />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="auditoria" element={<Auditoria />} />
          <Route path="administradores" element={<Administradores />} />
          <Route path="senha" element={<TrocarSenha />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
