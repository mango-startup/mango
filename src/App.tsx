import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RequireHost } from './components/RequireHost'
import { CameraPage } from './pages/Camera'
import { CreateEventPage } from './pages/CreateEvent'
import { EventDashboardPage } from './pages/EventDashboard'
import { GalleryPage } from './pages/Gallery'
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
        <Route path="/eventos" element={<RequireHost><MyEventsPage /></RequireHost>} />
        <Route path="/eventos/:id" element={<RequireHost><EventDashboardPage /></RequireHost>} />
        <Route path="/eventos/:id/pagamento" element={<RequireHost><PaymentStatusPage /></RequireHost>} />
        <Route path="/eventos/:id/moderacao" element={<RequireHost><ModerationPage /></RequireHost>} />

        {/* Convidado: um link por evento */}
        <Route path="/c/:codigo" element={<InvitePage />} />
        <Route path="/c/:codigo/f/:foto" element={<PhotoViewPage />} />

        {/* Protótipo antigo: sai quando o convite (#18, #19) e o álbum (#22) estiverem prontos */}
        <Route path="/camera" element={<CameraPage />} />
        <Route path="/galeria" element={<GalleryPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
