import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, Trash2, Save, Image as ImageIcon, FileText, Hammer, LayoutGrid, Star, LogOut, Check, Users, ClipboardList, Package, TrendingUp, Crown, DollarSign, MessageSquare, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import UsersTab from '../components/admin/UsersTab';
import QuotesTab from '../components/admin/QuotesTab';
import InventoryTab from '../components/admin/InventoryTab';
import FinancialTab from '../components/admin/FinancialTab';
import ReceivablesTab from '../components/admin/ReceivablesTab';
import ReportTab from '../components/admin/ReportTab';
import LogTab from '../components/admin/LogTab';
import ClientsTab from '../components/admin/ClientsTab';
import ProductsTab from '../components/admin/ProductsTab';
type TabId = 'settings' | 'services' | 'posts' | 'gallery' | 'testimonials' | 'users' | 'quotes' | 'inventory' | 'financial' | 'receivables' | 'reports' | 'logs' | 'clients' | 'products';

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('quotes'); // default; adjusted by useEffect once user loads
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [newService, setNewService] = useState({ title: '', description: '', image: null as File | null });
  const [newPost, setNewPost] = useState({ title: '', content: '', image: null as File | null });
  const [newGalleryItem, setNewGalleryItem] = useState({ description: '', serviceId: '', images: [] as File[] });
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<number[]>([]);
  const [newTestimonial, setNewTestimonial] = useState({ author: '', content: '', rating: 5 });
  const [pixKeys, setPixKeys] = useState<any[]>([]);
  const [newPix, setNewPix] = useState({ label: '', pixKey: '', keyType: 'cpf', bank: '', beneficiary: '', pixCode: '', qrCodeUrl: '' });
  const [pixQrFile, setPixQrFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' } | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (toast?.show) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error') => setToast({ show: true, message, type });

  useEffect(() => { checkAuth(); fetchPixKeys(); fetchCompanies(); }, []);

  const fetchCompanies = async () => {
    const res = await fetch('/api/companies', { credentials: 'include' });
    if (res.ok) setCompanies(await res.json());
  };

  const fetchPixKeys = () => {
    fetch('/api/pix-keys').then(r => r.json()).then(setPixKeys).catch(() => { });
  };
  const handleAddPix = async () => {
    if (!newPix.pixKey) return showToast('Chave PIX obrigatória', 'error');
    const payload = {
      label: newPix.label,
      pixKey: newPix.pixKey,       // Let server handle mapping or use common names
      keyType: newPix.keyType,
      bank: newPix.bank,
      beneficiary: newPix.beneficiary,
      pixCode: newPix.pixCode,
      qrCodeUrl: newPix.qrCodeUrl,
      sortOrder: 0
    };
    const res = await fetch('/api/pix-keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), credentials: 'include',
    });
    if (res.ok) { showToast('PIX adicionado!', 'success'); setNewPix({ label: '', pixKey: '', keyType: 'cpf', bank: '', beneficiary: '', pixCode: '', qrCodeUrl: '' }); fetchPixKeys(); }
    else showToast('Erro ao adicionar PIX', 'error');
  };
  const handleDeletePix = async (id: number) => {
    if (!confirm('Excluir esta chave PIX?')) return;
    await fetch(`/api/pix-keys/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchPixKeys();
    showToast('PIX removido', 'success');
  };
  const handleTogglePix = async (pk: any) => {
    await fetch(`/api/pix-keys/${pk.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pk, active: !pk.active }), credentials: 'include',
    });
    fetchPixKeys();
  };

  // Badge: poll pending quote count every 30s
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

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check', { credentials: 'include' });
      const data = await res.json();
      if (!data.authenticated) {
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
      } else {
        setCurrentUser(data);
        // Update localStorage with latest server data
        localStorage.setItem('user', JSON.stringify({
          authenticated: true, role: data.role, name: data.name || data.username, id: data.id,
        }));
        fetchData();
      }
    } catch {
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    }
    finally { setLoading(false); }
  };

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await fetch('/api/admin/data', { credentials: 'include' });
      if (res.status === 401) { localStorage.removeItem('user'); return navigate('/login', { replace: true }); }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSettings(data.settings);
      setServices(data.services);
      setPosts(data.posts);
      setGallery(data.gallery);
      setTestimonials(data.testimonials);
      setQuotes(data.quotes || []);
      setInventory(data.inventory || []);
      setUsers(data.users || []);
      if (data.currentUser) setCurrentUser(data.currentUser);
    } catch (err: any) {
      showToast('Erro ao carregar dados.', 'error');
    } finally { setLoading(false); setRefreshing(false); }
  };

  const handleLogout = async () => {
    try { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
    localStorage.removeItem('user');
    navigate('/', { replace: true });
  };

  const handleSaveSettings = async () => {
    const fd = new FormData();
    Object.entries(settings).forEach(([k, v]) => {
      if (!['logoUrl', 'heroImageUrl', 'pixQrCodeUrl'].includes(k)) fd.append(k, String(v));
    });
    if (logoFile) fd.append('logo', logoFile);
    if (heroFile) fd.append('heroImage', heroFile);
    const res = await fetch('/api/settings', { method: 'POST', body: fd, credentials: 'include' });
    if (res.status === 401) return navigate('/login');
    showToast('Configurações salvas!', 'success');
    setLogoFile(null); setHeroFile(null);
    fetchData(true);
  };

  const handleDelete = async (type: string, id: number) => {
    if (!confirm('Excluir este item?')) return;
    const res = await fetch(`/api/${type}/delete/${id}`, { method: 'POST', credentials: 'include' });
    if (res.ok) { fetchData(true); showToast('Excluído!', 'success'); }
    else showToast('Erro ao excluir', 'error');
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('title', newService.title); fd.append('description', newService.description);
    if (newService.image) fd.append('image', newService.image);
    const res = await fetch('/api/services', { method: 'POST', body: fd, credentials: 'include' });
    if (res.ok) {
      showToast('Serviço cadastrado com sucesso!', 'success');
      setNewService({ title: '', description: '', image: null });
      fetchData(true);
    } else {
      const data = await res.json();
      showToast(data.error || 'Erro ao cadastrar serviço', 'error');
    }
  };

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('title', newPost.title); fd.append('content', newPost.content);
    if (newPost.image) fd.append('image', newPost.image);
    const res = await fetch('/api/posts', { method: 'POST', body: fd, credentials: 'include' });
    if (res.ok) {
      showToast('Post publicado!', 'success');
      setNewPost({ title: '', content: '', image: null });
      fetchData(true);
    } else {
      const data = await res.json();
      showToast(data.error || 'Erro ao publicar post', 'error');
    }
  };

  const handleAddGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newGalleryItem.images.length === 0) return;
    const fd = new FormData();
    fd.append('description', newGalleryItem.description);
    if (newGalleryItem.serviceId) fd.append('serviceId', newGalleryItem.serviceId);
    newGalleryItem.images.forEach(img => fd.append('images', img));
    await fetch('/api/gallery', { method: 'POST', body: fd, credentials: 'include' });
    setNewGalleryItem({ description: '', serviceId: '', images: [] }); fetchData(true);
  };

  const handleAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/testimonials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTestimonial), credentials: 'include',
    });
    if (res.ok) {
      showToast('Depoimento adicionado!', 'success');
      setNewTestimonial({ author: '', content: '', rating: 5 });
      fetchData(true);
    } else {
      const data = await res.json();
      showToast(data.error || 'Erro ao adicionar depoimento', 'error');
    }
  };

  const handleBulkDeleteGallery = async () => {
    if (!selectedGalleryIds.length || !confirm(`Excluir ${selectedGalleryIds.length} fotos?`)) return;
    await fetch('/api/gallery/bulk-delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedGalleryIds }), credentials: 'include',
    });
    setSelectedGalleryIds([]); fetchData(true);
  };

  const loading_final = loading;
  if (loading_final) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 border-4 border-brand-primary border-t-white rounded-full animate-spin" />
      <p className="text-white/60 font-medium text-sm">Carregando painel…</p>
    </div>
  );

  const isMaster = currentUser?.role === 'master';
  const isAdmin = currentUser?.role === 'admin' || isMaster;


  const allTabs = [
    { id: 'settings', label: 'Geral', icon: Settings, show: isAdmin },
    { id: 'services', label: 'Serviços', icon: Hammer, show: isAdmin },
    { id: 'posts', label: 'Blog', icon: FileText, show: isAdmin },
    { id: 'gallery', label: 'Galeria', icon: LayoutGrid, show: isAdmin },
    { id: 'testimonials', label: 'Depoimentos', icon: Star, show: isAdmin },
    { id: 'clients', label: 'Clientes', icon: Users, show: true },
    { id: 'products', label: 'Produtos', icon: Package, show: true },
    { id: 'users', label: 'Usuários', icon: Users, show: isAdmin },
    { id: 'quotes', label: 'Gestão de Orçamentos', icon: ClipboardList, show: true, badge: pendingCount },
    { id: 'inventory', label: 'Estoque', icon: Package, show: isAdmin },
    { id: 'financial', label: 'Dashboard Financeiro', icon: TrendingUp, show: isAdmin },
    { id: 'receivables', label: 'Contas a Receber', icon: DollarSign, show: isAdmin },
    { id: 'reports', label: 'Parâmetros', icon: FileText, show: isAdmin },
    { id: 'logs', label: 'Logs', icon: Crown, show: isMaster },
  ].filter(t => t.show);

  const inputCls = 'w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-primary transition-all outline-none text-sm';
  const btnPrimary = 'bg-brand-primary text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-brand-primary/20 cursor-pointer';

  return (
    <div className="pt-20 md:pt-32 pb-24 bg-slate-50 min-h-screen">
      {/* Toast */}
      <AnimatePresence>
        {toast?.show && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed top-6 right-6 z-[200] px-6 py-3 rounded-2xl text-white font-bold shadow-xl ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Top Bar (Native App Feel) */}
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

      {/* Mobile Nav Drawer (Premium Native Feel) */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[160] md:hidden"
              onClick={() => setMobileNavOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[80vw] bg-slate-900 z-[170] md:hidden flex flex-col shadow-2xl border-l border-white/5">
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
              <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                {allTabs.map((tab: any) => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id as TabId); setMobileNavOpen(false); }}
                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-[13px] font-bold transition-all active:scale-[0.98]
                      ${activeTab === tab.id ? 'bg-brand-primary text-white shadow-xl shadow-brand-primary/20' : 'text-white/60 hover:bg-white/5'}`}>
                    <div className={clsx(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      activeTab === tab.id ? "bg-white/20" : "bg-white/5 text-brand-primary"
                    )}>
                      <tab.icon className="w-4 h-4" />
                    </div>
                    <span className="flex-1 text-left">{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white text-brand-primary' : 'bg-brand-primary text-white'}`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
              <div className="p-6 border-t border-white/5">
                <button onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold text-rose-400 bg-rose-400/10 border border-rose-400/20 active:scale-95 transition-all">
                  <LogOut className="w-4 h-4" /> Sair da conta
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar — desktop only */}
          <aside className="hidden md:block md:w-64 shrink-0">
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 sticky top-32">
              <div className="px-4 mb-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  Central do Usuário
                  {isMaster && <span className="flex items-center gap-1 text-amber-500 text-xs"><Crown className="w-3 h-3" />Master</span>}
                </h2>
                <p className="text-xs text-slate-500 mt-1 truncate">{currentUser?.name || currentUser?.username}</p>
              </div>
              <nav className="space-y-1">
                {allTabs.map((tab: any) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as TabId)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer
                      ${activeTab === tab.id ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <tab.icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white text-brand-primary' : 'bg-orange-500 text-white'}`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}

                <div className="pt-4 mt-4 border-t border-slate-100">
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all cursor-pointer">
                    <LogOut className="w-4 h-4" /> Sair
                  </button>
                </div>
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-grow min-w-0">
            <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-4 sm:p-6 md:p-12 shadow-sm border border-slate-100">

              {/* ─── SETTINGS ─── */}
              {activeTab === 'settings' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <h2 className="text-2xl font-bold mb-8">Configurações Gerais</h2>
                  <div className="grid grid-cols-1 gap-6">
                    {/* Logo */}
                    <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-2xl">
                      <div className="w-24 h-24 bg-white rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden">
                        {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-contain" /> : <ImageIcon className="w-8 h-8 text-slate-300" />}
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Logo</label>
                        <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)}
                          className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand-primary file:text-white cursor-pointer" />
                      </div>
                    </div>

                    {[
                      { label: 'Nome da Empresa *', key: 'companyName', type: 'text' },
                      { label: 'WhatsApp (DDD+número) *', key: 'whatsapp', type: 'text' },
                      { label: 'WhatsApp Master (notificações) *', key: 'whatsappMaster', type: 'text' },
                      { label: 'Endereço', key: 'address', type: 'text' },
                      { label: 'E-mail *', key: 'email', type: 'email' },
                      { label: 'Título Hero *', key: 'heroTitle', type: 'text' },
                      { label: 'Subtítulo Hero', key: 'heroSubtitle', type: 'text' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{f.label}</label>
                        <input type={f.type} value={settings[f.key] || ''} onChange={e => setSettings({ ...settings, [f.key]: e.target.value })}
                          className={inputCls} />
                      </div>
                    ))}

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Sobre a Empresa</label>
                      <textarea rows={4} value={settings.aboutText || ''} onChange={e => setSettings({ ...settings, aboutText: e.target.value })}
                        className={inputCls} />
                    </div>

                    {/* Hero Image */}
                    <div className="p-6 bg-slate-50 rounded-2xl">
                      <label className="block text-sm font-bold text-slate-700 mb-3">📸 Foto Hero (Tela Inicial)</label>
                      {settings.heroImageUrl && <img src={settings.heroImageUrl} className="w-full h-40 object-cover rounded-xl mb-4" />}
                      <input type="file" accept="image/*" onChange={e => setHeroFile(e.target.files?.[0] || null)}
                        className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand-primary file:text-white cursor-pointer" />
                    </div>



                  </div>
                  <button onClick={handleSaveSettings} className={btnPrimary}>
                    <Save className="w-5 h-5" /> Salvar Alterações
                  </button>
                </div>
              )}

              {/* ─── SERVICES ─── */}
              {activeTab === 'services' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <h2 className="text-2xl font-bold">Gerenciar Serviços</h2>
                  <form onSubmit={handleAddService} className="bg-slate-50 p-6 rounded-3xl space-y-4 mb-8">
                    <h3 className="font-bold">Adicionar Novo Serviço</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input placeholder="Título do Serviço *" value={newService.title} onChange={e => setNewService({ ...newService, title: e.target.value })} required className={inputCls} />
                      <input type="file" accept="image/*" onChange={e => setNewService({ ...newService, image: e.target.files?.[0] || null })} className={inputCls} />
                    </div>
                    <textarea placeholder="Descrição curta *" rows={3} value={newService.description} onChange={e => setNewService({ ...newService, description: e.target.value })} required className={inputCls} />
                    <button type="submit" className={btnPrimary}><Plus className="w-5 h-5" /> Adicionar</button>
                  </form>
                  <div className="grid gap-4">
                    {services.map(s => (
                      <div key={s.id} className="p-6 bg-white border border-slate-100 rounded-3xl hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            {s.imageUrl && <img src={s.imageUrl} className="w-16 h-16 rounded-xl object-cover" />}
                            <div><h4 className="font-bold">{s.title}</h4><p className="text-xs text-slate-500 line-clamp-1">{s.description}</p></div>
                          </div>
                          <button onClick={() => handleDelete('services', s.id)} className="text-red-500 p-3 hover:bg-red-50 rounded-xl cursor-pointer"><Trash2 className="w-5 h-5" /></button>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">🏠 Foto destaque na home</p>
                          <div className="flex items-center gap-4">
                            {s.homeImageUrl && <img src={s.homeImageUrl} className="w-20 h-16 rounded-lg object-cover border border-slate-200" />}
                            <input type="file" accept="image/*" onChange={async e => {
                              const file = e.target.files?.[0]; if (!file) return;
                              const fd = new FormData(); fd.append('homeImage', file);
                              const res = await fetch(`/api/services/${s.id}/home-image`, { method: 'POST', body: fd, credentials: 'include' });
                              if (res.ok) { showToast('Foto da home atualizada!', 'success'); fetchData(true); }
                            }} className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 cursor-pointer" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── POSTS ─── */}
              {activeTab === 'posts' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <h2 className="text-2xl font-bold">Publicações do Blog</h2>
                  <form onSubmit={handleAddPost} className="bg-slate-50 p-6 rounded-3xl space-y-4 mb-8">
                    <h3 className="font-bold">Novo Post no Blog</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input placeholder="Título do Post *" value={newPost.title} onChange={e => setNewPost({ ...newPost, title: e.target.value })} required className={inputCls} />
                      <input type="file" accept="image/*" onChange={e => setNewPost({ ...newPost, image: e.target.files?.[0] || null })} className={inputCls} />
                    </div>
                    <textarea placeholder="Conteúdo do post... *" rows={5} value={newPost.content} onChange={e => setNewPost({ ...newPost, content: e.target.value })} required className={inputCls} />
                    <button type="submit" className={btnPrimary}><Plus className="w-5 h-5" /> Publicar</button>
                  </form>
                  <div className="grid gap-4">
                    {posts.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          {p.imageUrl && <img src={p.imageUrl} className="w-16 h-16 rounded-xl object-cover" />}
                          <div><h4 className="font-bold">{p.title}</h4><p className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</p></div>
                        </div>
                        <button onClick={() => handleDelete('posts', p.id)} className="text-red-500 p-3 hover:bg-red-50 rounded-xl cursor-pointer"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── GALLERY ─── */}
              {activeTab === 'gallery' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Galeria de Fotos</h2>
                    <div className="flex gap-3">
                      {selectedGalleryIds.length > 0 && (
                        <button onClick={handleBulkDeleteGallery} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 cursor-pointer">
                          Excluir {selectedGalleryIds.length}
                        </button>
                      )}
                      <button onClick={() => setSelectedGalleryIds(selectedGalleryIds.length === gallery.length ? [] : gallery.map(i => i.id))}
                        className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-lg cursor-pointer">
                        {selectedGalleryIds.length === gallery.length ? 'Desmarcar' : 'Selecionar Todos'}
                      </button>
                    </div>
                  </div>
                  <form onSubmit={handleAddGallery} className="bg-slate-50 p-8 rounded-3xl space-y-6">
                    <h3 className="font-bold flex items-center gap-2"><ImageIcon className="w-5 h-5 text-brand-primary" />Adicionar Fotos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-2">Imagens (múltiplas)</label>
                        <input type="file" accept="image/*" multiple required onChange={e => setNewGalleryItem({ ...newGalleryItem, images: Array.from(e.target.files || []) })} className="w-full bg-white border-none rounded-2xl px-6 py-4" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-2">Serviço</label>
                        <select value={newGalleryItem.serviceId} onChange={e => setNewGalleryItem({ ...newGalleryItem, serviceId: e.target.value })} className="w-full bg-white border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-primary outline-none">
                          <option value="">Geral</option>
                          {services.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-2">Descrição</label>
                        <input placeholder="Descrição opcional" value={newGalleryItem.description} onChange={e => setNewGalleryItem({ ...newGalleryItem, description: e.target.value })} className="w-full bg-white border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-primary outline-none" />
                      </div>
                    </div>
                    <button type="submit" className="bg-brand-primary text-white px-8 py-4 rounded-2xl font-bold cursor-pointer">Enviar para Galeria</button>
                  </form>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {gallery.map(item => (
                      <div key={item.id} onClick={() => setSelectedGalleryIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])}
                        className={`relative group aspect-square rounded-2xl overflow-hidden border cursor-pointer transition-all ${selectedGalleryIds.includes(item.id) ? 'ring-4 ring-brand-primary border-brand-primary' : 'border-slate-100'}`}>
                        <img src={item.imageUrl} className="w-full h-full object-cover" />
                        <button type="button" onClick={e => { e.stopPropagation(); handleDelete('gallery', item.id); }}
                          className="absolute bottom-2 right-2 bg-red-600 text-white p-2 rounded-xl z-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── TESTIMONIALS ─── */}
              {activeTab === 'testimonials' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <h2 className="text-2xl font-bold">Depoimentos</h2>
                  <form onSubmit={handleAddTestimonial} className="bg-slate-50 p-8 rounded-3xl space-y-6">
                    <h3 className="font-bold flex items-center gap-2"><Star className="w-5 h-5 text-brand-primary" />Novo Depoimento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <input required placeholder="Nome do Cliente" value={newTestimonial.author} onChange={e => setNewTestimonial({ ...newTestimonial, author: e.target.value })} className="bg-white border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-primary outline-none" />
                      <select value={newTestimonial.rating} onChange={e => setNewTestimonial({ ...newTestimonial, rating: parseInt(e.target.value) })} className="bg-white border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-primary outline-none">
                        {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} Estrela{n > 1 ? 's' : ''}</option>)}
                      </select>
                    </div>
                    <textarea required rows={4} placeholder="Conteúdo..." value={newTestimonial.content} onChange={e => setNewTestimonial({ ...newTestimonial, content: e.target.value })} className="w-full bg-white border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-primary outline-none" />
                    <button type="submit" className="bg-brand-primary text-white px-8 py-4 rounded-2xl font-bold cursor-pointer">Adicionar</button>
                  </form>
                  <div className="grid gap-4">
                    {testimonials.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:shadow-md transition-all">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold">{t.author}</h4>
                            <div className="flex text-brand-primary">{[...Array(t.rating)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}</div>
                          </div>
                          <p className="text-sm text-slate-600 italic">"{t.content}"</p>
                        </div>
                        <button onClick={() => handleDelete('testimonials', t.id)} className="text-red-500 p-3 hover:bg-red-50 rounded-xl cursor-pointer"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── USERS ─── */}
              {activeTab === 'users' && isAdmin && (
                <UsersTab users={users} currentUser={currentUser} onSave={() => fetchData(true)} showToast={showToast} />
              )}

              {/* ─── CLIENTS ─── */}
              {activeTab === 'clients' && (
                <ClientsTab showToast={showToast} />
              )}

              {/* ─── PRODUCTS ─── */}
              {activeTab === 'products' && (
                <ProductsTab showToast={showToast} />
              )}

              {/* ─── QUOTES ─── */}
              {activeTab === 'quotes' && (
                <QuotesTab quotes={quotes} fetchData={fetchData} showToast={showToast} />
              )}

              {/* ─── INVENTORY ─── */}
              {activeTab === 'inventory' && isAdmin && (
                <InventoryTab inventory={inventory} onSave={() => fetchData(true)} showToast={showToast} />
              )}

              {/* ─── FINANCIAL ─── */}
              {activeTab === 'financial' && isAdmin && (
                <FinancialTab showToast={showToast} />
              )}

              {/* ─── RECEIVABLES ─── */}
              {activeTab === 'receivables' && isAdmin && (
                <ReceivablesTab showToast={showToast} />
              )}

              {/* ─── REPORTS ─── */}
              {activeTab === 'reports' && isAdmin && (
                <ReportTab showToast={showToast} isAdmin={isAdmin} isMaster={isMaster} />
              )}

              {/* ─── LOGS ─── */}
              {activeTab === 'logs' && isMaster && (
                <LogTab showToast={showToast} />
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

