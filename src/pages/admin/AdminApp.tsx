import { Route, Routes } from 'react-router-dom'
import { AoVivo } from './AoVivo'
import { Administradores } from './Administradores'
import { Analise } from './Analise'
import { Anfitrioes } from './Anfitrioes'
import { AdminLayout } from './AdminLayout'
import { Auditoria } from './Auditoria'
import { ComoAnfitriao } from './ComoAnfitriao'
import { Configuracoes } from './Configuracoes'
import { Crescimento } from './Crescimento'
import { EventoDetalhe } from './EventoDetalhe'
import { Financeiro } from './Financeiro'
import { Eventos } from './Eventos'
import { Moderacao as ModeracaoAdmin } from './Moderacao'
import { Pacotes } from './Pacotes'
import { Pagamentos } from './Pagamentos'
import { Resumo } from './Resumo'
import { Saude } from './Saude'
import { SimuladorPrecos } from './SimuladorPrecos'
import { TrocarSenha } from './TrocarSenha'
import { Uso } from './Uso'

// Rotas de /admin/*, carregadas sob demanda pelo App.
export default function AdminApp() {
  return (
    <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<Resumo />} />
            <Route path="crescimento" element={<Crescimento />} />
            <Route path="anfitrioes" element={<Anfitrioes />} />
            <Route path="moderacao" element={<ModeracaoAdmin />} />
            <Route path="saude" element={<Saude />} />
            <Route path="analise" element={<Analise />} />
            <Route path="ao-vivo" element={<AoVivo />} />
            <Route path="uso" element={<Uso />} />
            <Route path="eventos" element={<Eventos />} />
            <Route path="eventos/:id" element={<EventoDetalhe />} />
            <Route path="eventos/:id/anfitriao" element={<ComoAnfitriao />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="pagamentos" element={<Pagamentos />} />
            <Route path="pacotes" element={<Pacotes />} />
            <Route path="simulador-precos" element={<SimuladorPrecos />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="auditoria" element={<Auditoria />} />
            <Route path="administradores" element={<Administradores />} />
            <Route path="senha" element={<TrocarSenha />} />
          </Route>
    </Routes>
  )
}
