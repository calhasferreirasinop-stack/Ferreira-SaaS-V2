import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Hammer, LogOut, User as UserIcon, ChevronDown, Download } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [user, setUser] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    fetch('/api/settings')
      .then(res => res.json())
      .then(setSettings)
      .catch(err => console.error('Error fetching settings:', err));

    // Check user auth from localStorage (fast hydration)
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.authenticated) setUser(u);
      }
    } catch { /* ignore */ }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // PWA Install Logic
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Re-check user state on route change (e.g. after login)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.authenticated) setUser(u);
        else setUser(null);
      } else setUser(null);
    } catch { setUser(null); }
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    localStorage.removeItem('user');
    setUser(null);
    setShowUserMenu(false);
    setIsOpen(false);
    navigate('/login', { replace: true });
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const navLinks = [
    { name: '📐 Orçamento', path: '/app/orcamentos' },
    // === MODO BETA: links públicos ocultos ===
    // { name: 'Início', path: '/' },
    // { name: 'Serviços', path: '/servicos' },
    // { name: 'Galeria', path: '/galeria' },
    // { name: 'Blog', path: '/blog' },
  ];

  const isScrolledOrNotHome = scrolled || !isHome;

  return (
    <nav
      className={cn(
        'fixed top-0 w-full z-50 transition-all duration-300',
        isScrolledOrNotHome ? 'bg-white/95 backdrop-blur-md shadow-md py-2' : 'bg-transparent py-4'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 group">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-14 w-auto object-contain" />
            ) : (
              <>
                <div className="bg-brand-primary p-2 rounded-lg group-hover:rotate-12 transition-transform shadow-lg shadow-brand-primary/20">
                  <Hammer className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-xl font-black tracking-tighter transition-colors leading-none",
                    isScrolledOrNotHome ? "text-brand-dark" : "text-brand-dark md:text-white"
                  )}>
                    FERREIRA
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold tracking-[0.2em] uppercase transition-colors",
                    isScrolledOrNotHome ? "text-brand-primary" : "text-brand-primary"
                  )}>
                    Calhas e Rufos
                  </span>
                </div>
              </>
            )}
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'text-sm font-bold uppercase tracking-wider transition-colors hover:text-brand-primary',
                  location.pathname === link.path
                    ? 'text-brand-primary'
                    : isScrolledOrNotHome ? 'text-slate-600' : 'text-slate-600 md:text-white/90'
                )}
              >
                {link.name}
              </Link>
            ))}

            {/* User menu or Login link */}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button onClick={() => setShowUserMenu(v => !v)}
                  className={cn(
                    "flex items-center gap-2 text-[11px] uppercase tracking-widest font-black transition-colors border rounded-lg px-3 py-1.5 cursor-pointer",
                    isScrolledOrNotHome
                      ? "text-slate-600 border-slate-200 hover:text-brand-primary hover:border-brand-primary"
                      : "text-white/80 border-white/30 hover:text-white hover:border-white"
                  )}>
                  <UserIcon className="w-3.5 h-3.5" />
                  {user.name || 'Usuário'}
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showUserMenu && "rotate-180")} />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Link to="/app/gestao-orcamentos" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                      <UserIcon className="w-4 h-4" /> Central do Usuário
                    </Link>
                    {isInstallable && !isStandalone && (
                      <button onClick={handleInstallClick}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-brand-primary hover:bg-brand-primary/5 transition-colors w-full text-left cursor-pointer">
                        <Download className="w-4 h-4" /> Instalar Aplicativo
                      </button>
                    )}
                    <hr className="border-slate-100 my-1" />
                    <button onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors w-full text-left cursor-pointer">
                      <LogOut className="w-4 h-4" /> Sair
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "p-2 rounded-md",
                isScrolledOrNotHome ? "text-slate-900" : "text-slate-900 md:text-white"
              )}
            >
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {
        isOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 animate-in slide-in-from-top duration-300">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'block px-3 py-2 rounded-md text-base font-bold uppercase tracking-wider',
                    location.pathname === link.path
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {link.name}
                </Link>
              ))}

              {/* Mobile user section */}
              {user ? (
                <>
                  <div className="border-t border-slate-100 pt-2 mt-2">
                    <p className="px-3 py-1 text-xs font-bold text-slate-400 uppercase">
                      Logado como: {user.name || 'Usuário'}
                    </p>
                    <Link
                      to="/admin"
                      onClick={() => setIsOpen(false)}
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Central do Usuário
                    </Link>
                    {isInstallable && !isStandalone && (
                      <button
                        onClick={() => { handleInstallClick(); setIsOpen(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-brand-primary hover:bg-brand-primary/5 cursor-pointer"
                      >
                        <Download className="w-4 h-4" /> Instalar Aplicativo
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-3 py-2 rounded-md text-base font-bold text-red-500 hover:bg-red-50 cursor-pointer"
                    >
                      🚪 Sair
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
    </nav>
  );
}
