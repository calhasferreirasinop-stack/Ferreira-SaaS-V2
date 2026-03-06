import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Services from './pages/Services';
import Blog from './pages/Blog';
import Gallery from './pages/Gallery';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Orcamento from './pages/Orcamento';
import TestHarness from './pages/TestHarness';
import Production from './pages/Production';
import Fabricacao from './pages/Fabricacao';

function AppContent() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isAdmin = location.pathname.startsWith('/admin') || location.pathname.startsWith('/central') || location.pathname.startsWith('/producao');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <OfflineIndicator />
      {/* Show top Navbar on desktop, hide on mobile if it's redundant with bottom nav */}
      {!isMobile && <Navbar />}

      <main className={`flex-grow ${isMobile ? 'pt-[env(safe-area-inset-top)] pb-24' : 'pt-20 md:pb-0'}`}>
        <Routes>
          {/* === MODO BETA PRIVADO === */}
          {/* Página inicial redireciona para login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          {/* Páginas públicas desativadas temporariamente */}
          <Route path="/servicos" element={<Navigate to="/login" replace />} />
          {/* ... existing routes ... */}
          <Route path="/login" element={<Login />} />
          <Route path="/orcamento" element={
            <ErrorBoundary>
              <Orcamento />
            </ErrorBoundary>
          } />
          {/* Central do Usuário — /admin e /central (manter compatibilidade) */}
          <Route path="/admin" element={
            <ErrorBoundary>
              <Admin />
            </ErrorBoundary>
          } />
          <Route path="/central" element={
            <ErrorBoundary>
              <Admin />
            </ErrorBoundary>
          } />
          <Route path="/harness/*" element={
            <ErrorBoundary>
              <TestHarness />
            </ErrorBoundary>
          } />
          <Route path="/producao" element={
            <ErrorBoundary>
              <Production />
            </ErrorBoundary>
          } />
          <Route path="/fabricacao/:estimateId" element={
            <ErrorBoundary>
              <Fabricacao />
            </ErrorBoundary>
          } />
          {/* Qualquer rota desconhecida → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>

      {/* Footer and WhatsApp only on desktop non-admin pages */}
      {!isMobile && !isAdmin && <Footer />}
      {!isMobile && !isAdmin && <WhatsAppButton />}

      {/* Bottom Nav ONLY on mobile */}
      {isMobile && <BottomNav />}
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
