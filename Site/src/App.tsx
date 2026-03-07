import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import BottomNav from './components/BottomNav';
import DashboardLayout from './components/DashboardLayout';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Orcamento from './pages/Orcamento';
import TestHarness from './pages/TestHarness';
import Production from './pages/Production';
import Fabricacao from './pages/Fabricacao';

function LegacyRedirects() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');

  // Map old tabs to new routes
  const tabMap: Record<string, string> = {
    'clients': '/app/clientes',
    'products': '/app/produtos',
    'quotes': '/app/gestao-orcamentos',
    'production_admin': '/app/producao',
    'inventory': '/app/estoque',
    'financial': '/app/dashboard-financeiro',
    'revenue': '/app/dashboard-financeiro',
    'receivables': '/app/contas-a-receber',
    'reports': '/app/parametros',
    'logs': '/app/logs',
    'settings': '/site/geral',
    'services': '/site/servicos',
    'posts': '/site/blog',
    'gallery': '/site/galeria',
    'testimonials': '/site/depoimentos',
    'users': '/admin/usuarios'
  };

  if (location.pathname === '/admin' || location.pathname === '/central') {
    const target = tab ? tabMap[tab] : '/app/gestao-orcamentos';
    return <Navigate to={target || '/app/gestao-orcamentos'} replace />;
  }

  if (location.pathname === '/orcamento') {
    return <Navigate to="/app/orcamentos" replace />;
  }

  return null;
}

function AppContent() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isInternal = location.pathname.startsWith('/app') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/site');

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <OfflineIndicator />

      {/* Show Navbar on Public/Site pages (Desktop) */}
      {!isMobile && !isInternal && !isLoginPage && <Navbar />}

      <main className={`flex-grow ${isMobile ? 'pt-[env(safe-area-inset-top)] pb-24' : (isInternal || isLoginPage || location.pathname === '/' ? 'pt-0' : 'pt-20 md:pb-0')}`}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          {/* Legacy Redirects */}
          <Route path="/admin" element={<LegacyRedirects />} />
          <Route path="/central" element={<LegacyRedirects />} />
          <Route path="/orcamento" element={<LegacyRedirects />} />

          {/* APP Segment */}
          <Route path="/app" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/app/gestao-orcamentos" replace />} />
            <Route path="clientes" element={<Admin />} />
            <Route path="produtos" element={<Admin />} />
            <Route path="orcamentos" element={<Orcamento />} />
            <Route path="gestao-orcamentos" element={<Admin />} />
            <Route path="producao" element={<Admin />} />
            <Route path="estoque" element={<Admin />} />
            <Route path="dashboard-financeiro" element={<Admin />} />
            <Route path="contas-a-receber" element={<Admin />} />
            <Route path="parametros" element={<Admin />} />
            <Route path="logs" element={<Admin />} />
          </Route>

          {/* ADMIN Segment */}
          <Route path="/admin" element={<DashboardLayout />}>
            <Route path="usuarios" element={<Admin />} />
            <Route path="planos" element={<Admin />} />
            <Route path="empresas" element={<Admin />} />
          </Route>

          {/* SITE Segment */}
          <Route path="/site" element={<DashboardLayout />}>
            <Route path="geral" element={<Admin />} />
            <Route path="servicos" element={<Admin />} />
            <Route path="blog" element={<Admin />} />
            <Route path="galeria" element={<Admin />} />
            <Route path="depoimentos" element={<Admin />} />
          </Route>

          {/* Other Tools */}
          <Route path="/fabricacao/:estimateId" element={<Fabricacao />} />
          <Route path="/harness/*" element={<TestHarness />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer and WhatsApp only on public pages */}
      {!isMobile && !isInternal && !isLoginPage && <Footer />}
      {!isMobile && !isInternal && !isLoginPage && <WhatsAppButton />}

      {/* Bottom Nav on Mobile for internal pages */}
      {isMobile && isInternal && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
