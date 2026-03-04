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

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-brand-primary" /> Logs do Sistema</h2>
                <button onClick={fetchLogs} disabled={loading}
                    className="px-4 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50 cursor-pointer">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                </button>
            </div>

            {/* Filters */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Usuário</label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input value={filterUser} onChange={e => setFilterUser(e.target.value)}
                                placeholder="Buscar usuário..."
                                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Ação</label>
                        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary">
                            <option value="">Todas</option>
                            {uniqueActions.map(a => (
                                <option key={a} value={a}>{ACTION_CONFIG[a]?.label || a}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Data Início</label>
                        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Data Fim</label>
                        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary" />
                    </div>
                </div>
                <div className="mt-3 flex gap-2">
                    <button onClick={fetchLogs} className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm cursor-pointer hover:opacity-90 flex items-center gap-1">
                        <Search className="w-3.5 h-3.5" /> Filtrar
                    </button>
                    <button onClick={() => { setFilterUser(''); setFilterAction(''); setFilterFrom(''); setFilterTo(''); setTimeout(fetchLogs, 50); }}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 cursor-pointer">
                        Limpar
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-green-50 rounded-2xl p-4">
                    <p className="text-xs text-green-600 font-bold uppercase">Logins OK</p>
                    <p className="text-2xl font-black text-green-700 mt-1">{logs.filter(l => l.action === 'LOGIN_SUCCESS').length}</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-4">
                    <p className="text-xs text-red-600 font-bold uppercase">Logins Falhos</p>
                    <p className="text-2xl font-black text-red-700 mt-1">{logs.filter(l => l.action === 'LOGIN_FAILED').length}</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4">
                    <p className="text-xs text-blue-600 font-bold uppercase">Ações</p>
                    <p className="text-2xl font-black text-blue-700 mt-1">{logs.filter(l => !['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'].includes(l.action)).length}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 font-bold uppercase">Total</p>
                    <p className="text-2xl font-black text-slate-700 mt-1">{logs.length}</p>
                </div>
            </div>

            {/* Log list */}
            {loading ? (
                <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : logs.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Nenhum log encontrado.</p>
            ) : (
                <div className="space-y-2">
                    {logs.filter(l => {
                        if (filterAction && l.action !== filterAction) return false;
                        return true;
                    }).map((log, i) => {
                        const cfg = ACTION_CONFIG[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600', icon: <FileText className="w-4 h-4" /> };
                        const isFailed = log.action === 'LOGIN_FAILED';
                        return (
                            <div key={log.id || i} className={`bg-white border rounded-2xl p-4 flex items-start gap-4 transition-all hover:shadow-sm ${isFailed ? 'border-red-200' : 'border-slate-100'}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                                    {cfg.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                                        <span className="text-sm font-bold text-slate-800">{log.username}</span>
                                        {log.menu && <span className="text-xs text-slate-400">· {log.menu}</span>}
                                    </div>
                                    <p className="text-sm text-slate-600 mt-0.5">{log.details}</p>
                                    {log.errorMessage && (
                                        <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                                            <ShieldAlert className="w-3 h-3" /> {log.errorMessage}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                        <span>{new Date(log.createdAt).toLocaleDateString('pt-BR')} {new Date(log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                        {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
