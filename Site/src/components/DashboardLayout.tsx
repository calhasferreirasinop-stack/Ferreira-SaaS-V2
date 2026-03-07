import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import {
    Settings, Hammer, FileText, LayoutGrid, Star, Users, Package,
    ClipboardList, Factory, TrendingUp, DollarSign, Crown, LogOut,
    Menu, X, ChevronDown, User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';

type TabId = 'settings' | 'services' | 'posts' | 'gallery' | 'testimonials' | 'users' | 'quotes' | 'inventory' | 'financial' | 'receivables' | 'reports' | 'logs' | 'clients' | 'products' | 'production_admin' | 'dashboard' | 'orcamento' | 'companies' | 'plans';

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'FUNCIONARIO_PRODUCAO' | 'master' | 'admin' | 'user';

export default function DashboardLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [showSiteMenus, setShowSiteMenus] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const stored = localStorage.getItem('user');
                if (stored) {
                    const u = JSON.parse(stored);
                    if (u.authenticated) setCurrentUser(u);
                    else navigate('/login', { replace: true });
                } else {
                    navigate('/login', { replace: true });
                }
            } catch {
                navigate('/login', { replace: true });
            }
        };
        checkAuth();
    }, [navigate]);

    useEffect(() => {
        const refresh = () =>
            fetch('/api/quotes/pending-count', { credentials: 'include' })
                .then(r => r.ok ? r.json() : { count: 0 })
                .then(d => setPendingCount(d.count || 0))
                .catch(() => { });
        refresh();
        const interval = setInterval(refresh, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        try { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
    };

    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'master';
    const isOwner = currentUser?.role === 'OWNER' || currentUser?.role === 'admin' || isSuperAdmin;
    const isAdmin = currentUser?.role === 'ADMIN' || isOwner;
    const isProduction = currentUser?.role === 'FUNCIONARIO_PRODUCAO' || isAdmin;

    const allTabs = [
        // SITE (SUPER_ADMIN Only)
        { id: 'settings', label: 'Geral', icon: Settings, path: '/site/geral', show: isSuperAdmin, group: 'site' },
        { id: 'services', label: 'Serviços', icon: Hammer, path: '/site/servicos', show: isSuperAdmin, group: 'site' },
        { id: 'posts', label: 'Blog', icon: FileText, path: '/site/blog', show: isSuperAdmin, group: 'site' },
        { id: 'gallery', label: 'Galeria', icon: LayoutGrid, path: '/site/galeria', show: isSuperAdmin, group: 'site' },
        { id: 'testimonials', label: 'Depoimentos', icon: Star, path: '/site/depoimentos', show: isSuperAdmin, group: 'site' },
        // APP
        { id: 'clients', label: 'Clientes', icon: Users, path: '/app/clientes', show: isProduction, group: 'app' },
        { id: 'products', label: 'Produtos', icon: Package, path: '/app/produtos', show: isProduction, group: 'app' },
        { id: 'orcamento', label: 'Calculadora de Orçamento', icon: Hammer, path: '/app/orcamentos', show: isProduction, group: 'app' },
        { id: 'quotes', label: 'Gestão de Orçamentos', icon: ClipboardList, path: '/app/gestao-orcamentos', show: isProduction, group: 'app' },
        { id: 'production_admin', label: 'Produção', icon: Factory, path: '/app/producao', show: isProduction, group: 'app' },
        { id: 'inventory', label: 'Estoque', icon: Package, path: '/app/estoque', show: isProduction, group: 'app' },
        { id: 'financial', label: 'Dashboard Financeiro', icon: TrendingUp, path: '/app/dashboard-financeiro', show: isAdmin, group: 'app' },
        { id: 'receivables', label: 'Contas a Receber', icon: DollarSign, path: '/app/contas-a-receber', show: isAdmin, group: 'app' },
        { id: 'reports', label: 'Parâmetros', icon: FileText, path: '/app/parametros', show: isOwner, group: 'app' },
        { id: 'logs', label: 'Logs', icon: Crown, path: '/app/logs', show: isSuperAdmin, group: 'app' },
        // ADMIN
        { id: 'users', label: 'Usuários', icon: Users, path: '/admin/usuarios', show: isOwner, group: 'admin' },
        { id: 'companies', label: 'Empresas', icon: Factory, path: '/admin/empresas', show: isSuperAdmin, group: 'admin' },
        { id: 'plans', label: 'Planos', icon: Crown, path: '/admin/planos', show: isSuperAdmin, group: 'admin' },
    ].filter(t => t.show);

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="pt-20 md:pt-32 pb-24 bg-slate-50 min-h-screen">
            {/* Desktop Header */}
            <div className="hidden md:block fixed top-0 left-0 right-0 z-[140] bg-white/80 backdrop-blur-xl border-b border-slate-100 h-20">
                <div className="max-w-[1600px] mx-auto h-full px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                            <Hammer className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">CalhaFlow <span className="text-brand-primary">SaaS</span></h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{location.pathname.startsWith('/admin') ? 'Administração Global' : (location.pathname.startsWith('/site') ? 'Gestão de Conteúdo' : 'Operações da Empresa')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-slate-900">{currentUser?.name || currentUser?.username}</span>
                            <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1 uppercase tracking-widest">
                                {(isSuperAdmin) && <Crown className="w-3 h-3" />} {currentUser?.role}
                            </span>
                        </div>
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                            <UserIcon className="w-5 h-5 text-slate-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Top Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-[150] bg-slate-900/95 backdrop-blur-xl border-b border-white/5 px-4 pt-[env(safe-area-inset-top)] flex items-center justify-between h-[calc(64px+env(safe-area-inset-top))]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/30">
                        <Hammer className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">CalhaFlow</p>
                        <p className="text-sm font-bold text-white truncate max-w-[150px]">{currentUser?.name || currentUser?.username}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                        <div className="bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-pulse">
                            {pendingCount}
                        </div>
                    )}
                    <button onClick={() => setMobileNavOpen(true)}
                        className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 active:scale-95 transition-all">
                        <Menu className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            {/* Mobile Nav Drawer */}
            <AnimatePresence>
                {mobileNavOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[160] md:hidden"
                            onClick={() => setMobileNavOpen(false)} />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 bottom-0 w-[80vw] bg-slate-900 z-[170] md:hidden flex flex-col shadow-2xl border-l border-white/5 overflow-y-auto">
                            {/* Drawer Content */}
                            <div className="flex items-center justify-between px-6 py-8 border-b border-white/5">
                                <div>
                                    <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-1">MENU PRINCIPAL</p>
                                    <p className="text-lg font-bold text-white">{currentUser?.name || currentUser?.username}</p>
                                </div>
                                <button onClick={() => setMobileNavOpen(false)}
                                    className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/10">
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                            <nav className="flex-1 p-4 space-y-6">
                                {/* Site Group */}
                                <div>
                                    <h3 className="px-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Conteúdo do Site</h3>
                                    {allTabs.filter(t => t.group === 'site').map((tab) => (
                                        <Link key={tab.id} to={tab.path} onClick={() => setMobileNavOpen(false)}
                                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[13px] font-bold transition-all
                        ${isActive(tab.path) ? 'bg-brand-primary text-white' : 'text-white/60 hover:bg-white/5'}`}>
                                            <tab.icon className="w-4 h-4" />
                                            <span>{tab.label}</span>
                                        </Link>
                                    ))}
                                </div>
                                {/* App Group */}
                                <div>
                                    <h3 className="px-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Operacional</h3>
                                    {allTabs.filter(t => t.group === 'app').map((tab) => (
                                        <Link key={tab.id} to={tab.path} onClick={() => setMobileNavOpen(false)}
                                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[13px] font-bold transition-all
                        ${isActive(tab.path) ? 'bg-brand-primary text-white' : 'text-white/60 hover:bg-white/5'}`}>
                                            <tab.icon className="w-4 h-4" />
                                            <span className="flex-1">{tab.label}</span>
                                            {tab.badge ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500 text-white">{tab.badge}</span> : null}
                                        </Link>
                                    ))}
                                </div>
                                {/* Admin Group */}
                                <div>
                                    <h3 className="px-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Sistema</h3>
                                    {allTabs.filter(t => t.group === 'admin').map((tab) => (
                                        <Link key={tab.id} to={tab.path} onClick={() => setMobileNavOpen(false)}
                                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[13px] font-bold transition-all
                        ${isActive(tab.path) ? 'bg-brand-primary text-white' : 'text-white/60 hover:bg-white/5'}`}>
                                            <tab.icon className="w-4 h-4" />
                                            <span>{tab.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            </nav>
                            <div className="p-6 border-t border-white/5">
                                <button onClick={handleLogout}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold text-rose-400 bg-rose-400/10 border border-rose-400/20 active:scale-95 transition-all">
                                    <LogOut className="w-4 h-4" /> Sair
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Sidebar - Desktop */}
                    <aside className="hidden md:block md:w-64 shrink-0">
                        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 sticky top-24">
                            <div className="px-4 mb-4">
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                    {isSuperAdmin ? 'Master Admin' : 'Painel Control'}
                                </h2>
                                <p className="text-xs text-slate-500 mt-1 truncate">{currentUser?.name || currentUser?.username}</p>
                            </div>
                            <nav className="space-y-1">
                                {/* SITE MENUS */}
                                <div className="mb-2">
                                    <button onClick={() => setShowSiteMenus(!showSiteMenus)}
                                        className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 transition-colors">
                                        <span>Conteúdo do Site</span>
                                        <motion.span animate={{ rotate: showSiteMenus ? 0 : -90 }}><ChevronDown className="w-3 h-3" /></motion.span>
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {showSiteMenus && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-1">
                                                {allTabs.filter(t => t.group === 'site').map((tab) => (
                                                    <Link key={tab.id} to={tab.path}
                                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
                              ${isActive(tab.path) ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-600 hover:bg-slate-50'}`}>
                                                        <tab.icon className="w-4 h-4" />
                                                        <span className="flex-1 text-left">{tab.label}</span>
                                                    </Link>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* APP MENUS */}
                                <div className="space-y-1">
                                    <p className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Operacional</p>
                                    {allTabs.filter(t => t.group === 'app').map((tab) => (
                                        <Link key={tab.id} to={tab.path}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
                        ${isActive(tab.path) ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            <tab.icon className="w-4 h-4" />
                                            <span className="flex-1 text-left">{tab.label}</span>
                                            {tab.badge ? <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isActive(tab.path) ? 'bg-white text-brand-primary' : 'bg-orange-500 text-white'}`}>{tab.badge}</span> : null}
                                        </Link>
                                    ))}
                                </div>

                                {/* ADMIN MENUS */}
                                {allTabs.some(t => t.group === 'admin') && (
                                    <div className="space-y-1 mt-4 pt-4 border-t border-slate-100">
                                        <p className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Gestão</p>
                                        {allTabs.filter(t => t.group === 'admin').map((tab) => (
                                            <Link key={tab.id} to={tab.path}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
                            ${isActive(tab.path) ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-600 hover:bg-slate-50'}`}>
                                                <tab.icon className="w-4 h-4" />
                                                <span className="flex-1 text-left">{tab.label}</span>
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                <div className="pt-4 mt-4 border-t border-slate-100">
                                    <button onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all cursor-pointer">
                                        <LogOut className="w-4 h-4" /> Sair
                                    </button>
                                </div>
                            </nav>
                        </div>
                    </aside>

                    {/* Content Area */}
                    <main className="flex-grow min-w-0">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
}
