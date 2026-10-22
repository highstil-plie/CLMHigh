import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import DocumentDetail from './pages/DocumentDetail'
import Tasks from './pages/Tasks'
import Reports, { ReportDetail } from './pages/Reports'
import Contacts from './pages/Contacts'
import Parties, { PartyDetail } from './pages/Parties'
import Admin from './pages/Admin'
import Generate from './pages/Generate'

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/clm/gerar" element={<Generate />} />
          <Route path="/clm" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="documentos" element={<Documents />} />
            <Route path="documentos/:id" element={<DocumentDetail />} />
            <Route path="tarefas" element={<Tasks />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="relatorios/:id" element={<ReportDetail />} />
            <Route path="contatos" element={<Contacts />} />
            <Route path="partes" element={<Parties />} />
            <Route path="partes/:id" element={<PartyDetail />} />
            <Route path="admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}
