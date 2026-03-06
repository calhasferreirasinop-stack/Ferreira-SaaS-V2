import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Shield, ShieldAlert, LogIn, LogOut, FileText, Package, Settings, Trash2 } from 'lucide-react';

interface Props {
    showToast: (msg: string, type: 'success' | 'error') => void;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    LOGIN_SUCCESS: { label: 'Login OK', color: 'bg-green-100 text-green-700', icon: <LogIn className="w-4 h-4" /> },
    LOGIN_FAILED: { label: 'Login Falho', color: 'bg-red-100 text-red-700', icon: <ShieldAlert className="w-4 h-4" /> },
    LOGOUT: { label: 'Logout', color: 'bg-slate-100 text-slate-600', icon: <LogOut className="w-4 h-4" /> },
    QUOTE_STATUS_CHANGE: { label: 'Status Orç.', color: 'bg-blue-100 text-blue-700', icon: <FileText className="w-4 h-4" /> },
    QUOTE_CREATE: { label: 'Novo Orç.', color: 'bg-emerald-100 text-emerald-700', icon: <FileText className="w-4 h-4" /> },
    QUOTE_EDIT: { label: 'Editar Orç.', color: 'bg-amber-100 text-amber-700', icon: <FileText className="w-4 h-4" /> },
    INVENTORY_ADD: { label: 'Estoque +', color: 'bg-green-100 text-green-700', icon: <Package className="w-4 h-4" /> },
    INVENTORY_DELETE: { label: 'Estoque -', color: 'bg-red-100 text-red-700', icon: <Trash2 className="w-4 h-4" /> },
    SETTINGS_UPDATE: { label: 'Config.', color: 'bg-purple-100 text-purple-700', icon: <Settings className="w-4 h-4" /> },
};

export default function LogTab({ showToast }: Props) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterUser, setFilterUser] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterUser) params.set('username', filterUser);
            if (filterAction) params.set('action', filterAction);
            if (filterFrom) params.set('from', new Date(filterFrom).toISOString());
            if (filterTo) params.set('to', new Date(filterTo + 'T23:59:59').toISOString());
            const res = await fetch(`/api/user-logs?${params}`, { credentials: 'include' });
            if (res.ok) setLogs(await res.json());
            else showToast('Erro ao carregar logs', 'error');
        } catch { showToast('Erro ao carregar logs', 'error'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchLogs(); }, []);

    const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

    const filteredLogs = logs.filter(l => {
        if (filterAction && l.action !== filterAction) return false;
        return true;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-brand-primary" /> Logs do Sistema</h2>
                <button onClick={fetchLogs} disabled={loading}
                    className="px-4 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50 cursor-pointer transition-all active:scale-95 shadow-lg shadow-brand-primary/20">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Usuário</label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input value={filterUser} onChange={e => setFilterUser(e.target.value)}
                                placeholder="Buscar usuário..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Ação</label>
                        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all">
                            <option value="">Todas as Ações</option>
                            {uniqueActions.map(a => (
                                <option key={a} value={a}>{ACTION_CONFIG[a]?.label || a}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Início</label>
                        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Fim</label>
                        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all" />
                    </div>
                </div>
                <div className="mt-6 flex gap-3">
                    <button onClick={fetchLogs} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-700 transition-all flex items-center gap-2">
                        <Search className="w-4 h-4" /> Filtrar Resultados
                    </button>
                    <button onClick={() => { setFilterUser(''); setFilterAction(''); setFilterFrom(''); setFilterTo(''); setTimeout(fetchLogs, 50); }}
                        className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 cursor-pointer hover:bg-slate-50 transition-all">
                        Limpar Filtros
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Logins OK</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{logs.filter(l => l.action === 'LOGIN_SUCCESS').length}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Logins Falhos</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{logs.filter(l => l.action === 'LOGIN_FAILED').length}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Ações</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{logs.filter(l => !['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'].includes(l.action)).length}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Geral</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{logs.length}</p>
                </div>
            </div>

            {/* Log list */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : filteredLogs.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-[2rem] p-16 text-center shadow-sm">
                    <Shield className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">Nenhum log encontrado para os filtros selecionados.</p>
                </div>
            ) : isMobile ? (
                <div className="space-y-3">
                    {filteredLogs.map((log, i) => {
                        const cfg = ACTION_CONFIG[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600', icon: <FileText className="w-4 h-4" /> };
                        const isFailed = log.action === 'LOGIN_FAILED';
                        return (
                            <div key={log.id || i} className={`bg-white border rounded-2xl p-4 flex items-start gap-4 transition-all hover:shadow-md ${isFailed ? 'border-red-200' : 'border-slate-100'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                                    {cfg.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                                        <span className="text-sm font-bold text-slate-900">{log.username}</span>
                                        {log.menu && <span className="text-xs text-slate-400">· {log.menu}</span>}
                                    </div>
                                    <p className="text-sm text-slate-600 mt-1">{log.details}</p>
                                    {log.errorMessage && (
                                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium bg-red-50 p-2 rounded-lg">
                                            <ShieldAlert className="w-3.5 h-3.5" /> {log.errorMessage}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <span>{new Date(log.createdAt).toLocaleDateString('pt-BR')} {new Date(log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        {log.ipAddress && <span className="text-slate-300">|</span>}
                                        {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Data / Hora</th>
                                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Usuário</th>
                                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Ação</th>
                                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Detalhes</th>
                                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">IP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLogs.map((log, i) => {
                                    const cfg = ACTION_CONFIG[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600', icon: <FileText className="w-4 h-4" /> };
                                    const isFailed = log.action === 'LOGIN_FAILED';
                                    return (
                                        <tr key={log.id || i} className={`hover:bg-slate-50/50 transition-colors ${isFailed ? 'bg-red-50/30' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <p className="font-bold text-slate-900">{new Date(log.createdAt).toLocaleDateString('pt-BR')}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{new Date(log.createdAt).toLocaleTimeString('pt-BR')}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                                                        {log.username?.substring(0, 2)}
                                                    </div>
                                                    <span className="font-bold text-slate-800">{log.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>
                                                    {cfg.icon} {cfg.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-slate-600 font-medium">{log.details}</p>
                                                {log.errorMessage && (
                                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-bold">
                                                        <ShieldAlert className="w-3.5 h-3.5" /> {log.errorMessage}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono text-slate-400">
                                                {log.ipAddress || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
