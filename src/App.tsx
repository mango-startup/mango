import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { carregarConfig } from './lib/configPublica'
import { AvisoGlobal } from './components/AvisoGlobal'
import { NavegacaoAnimada } from './components/NavegacaoAnimada'
import { RequireHost } from './components/RequireHost'
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

// O admin (e o shadcn/ui que ele usa) vira um chunk à parte: a landing e a câmera não pagam por ele.
const AdminApp = lazy(() => import('./pages/admin/AdminApp'))

// Links de miniatura escritos como "/=v3" (em vez de "/?v=3") caem na landing.
function NaoEncontradaOuRaiz() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/=')) return <Navigate to="/" replace />
  return <NotFoundPage />
}

export default function App() {
  useEffect(() => {
    void carregarConfig()
  }, [])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AvisoGlobal />
      <NavegacaoAnimada>
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
        <Route path="/admin/*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />

        <Route path="*" element={<NaoEncontradaOuRaiz />} />
      </Routes>
      </NavegacaoAnimada>
    </BrowserRouter>
  )
}
