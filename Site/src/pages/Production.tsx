import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    Factory, RefreshCw, CheckCircle, PlayCircle, PackageCheck, Truck,
    Clock, AlertCircle, LogOut, ChevronRight
} from 'lucide-react';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; next?: string; nextLabel?: string }> = {
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock className="w-4 h-4" />, next: 'accepted', nextLabel: '✅ Aceitar Pedido' },
    accepted: { label: 'Aceito', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <CheckCircle className="w-4 h-4" />, next: 'in_production', nextLabel: '🏭 Iniciar Produção' },
    in_production: { label: 'Em Produção', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: <PlayCircle className="w-4 h-4" />, next: 'ready', nextLabel: '📦 Marcar Pronto' },
    ready: { label: 'Pronto', color: 'bg-green-100 text-green-800 border-green-200', icon: <PackageCheck className="w-4 h-4" />, next: 'delivered', nextLabel: '🚛 Marcar Entregue' },
    delivered: { label: 'Entregue', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <Truck className="w-4 h-4" /> },
};

export default function Production() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => { checkAuth(); }, []);

    const checkAuth = async () => {
        const res = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await res.json();
        if (!data.authenticated) return navigate('/login');
        setCurrentUser(data);
        fetchOrders();
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/production', { credentials: 'include' });
            if (!res.ok) throw new Error();
            setOrders(await res.json());
        } catch {
            showToast('Erro ao carregar pedidos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        setUpdating(orderId);
        try {
            const res = await fetch(`/api/production/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
                credentials: 'include'
            });
            if (!res.ok) throw new Error(await res.text());
            showToast('Status atualizado!', 'success');
            fetchOrders();
        } catch (e: any) {
            showToast(e.message || 'Erro ao atualizar', 'error');
        } finally {
            setUpdating(null);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
        navigate('/');
    };

    // Split orders: received (target) vs sent (origin)
    const receivedOrders = orders.filter(o => o.side === 'target');
    const sentOrders = orders.filter(o => o.side === 'origin');

    return (
        <div className="min-h-screen bg-slate-900 text-white">

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl font-bold shadow-xl text-white ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="border-b border-white/10 bg-slate-900/90 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Factory className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black">Pedidos de Produção</h1>
                            <p className="text-xs text-slate-400">{currentUser?.name || currentUser?.username}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchOrders} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" title="Atualizar">
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => navigate('/admin')} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold transition-colors cursor-pointer">
                            Admin
                        </button>
                        <button onClick={handleLogout} className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <RefreshCw className="w-10 h-10 text-blue-400 animate-spin" />
                        <p className="text-slate-400">Carregando pedidos...</p>
                    </div>
                ) : (
                    <>
                        {/* ── PEDIDOS RECEBIDOS (como fábrica/target) ── */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                    <Factory className="w-5 h-5 text-blue-400" />
                                </div>
                                <h2 className="text-xl font-black">Pedidos Recebidos</h2>
                                {receivedOrders.length > 0 && (
                                    <span className="px-3 py-1 bg-blue-500 text-white text-xs font-black rounded-full">
                                        {receivedOrders.filter(o => o.status === 'pending').length} pendentes
                                    </span>
                                )}
                            </div>

                            {receivedOrders.length === 0 ? (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
                                    <Factory className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400">Nenhum pedido recebido ainda.</p>
                                    <p className="text-slate-500 text-sm mt-1">Quando uma empresa instaladora aprovar um orçamento vinculado a você, o pedido aparecerá aqui.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {receivedOrders.map(order => (
                                        <OrderCard
                                            key={order.id}
                                            order={order}
                                            mode="target"
                                            onUpdateStatus={handleUpdateStatus}
                                            updating={updating === order.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* ── PEDIDOS ENVIADOS (como instalador/origin) ── */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-green-500/20 rounded-xl flex items-center justify-center">
                                    <ChevronRight className="w-5 h-5 text-green-400" />
                                </div>
                                <h2 className="text-xl font-black">Pedidos Enviados</h2>
                                <span className="text-xs text-slate-500">(seus orçamentos enviados para a fábrica)</span>
                            </div>

                            {sentOrders.length === 0 ? (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
                                    <p className="text-slate-500 text-sm">Nenhum pedido enviado ainda.</p>
                                    <p className="text-slate-600 text-xs mt-1">Configure uma Empresa de Dobra em Configurações → Geral para habilitar o envio automático.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {sentOrders.map(order => (
                                        <OrderCard
                                            key={order.id}
                                            order={order}
                                            mode="origin"
                                            onUpdateStatus={handleUpdateStatus}
                                            updating={updating === order.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

// ── OrderCard Component ───────────────────────────────────────────────────────
interface OrderCardProps {
    order: any;
    mode: 'origin' | 'target';
    onUpdateStatus: (id: string, status: string) => void;
    updating: boolean;
}

function OrderCard({ order, mode, onUpdateStatus, updating }: OrderCardProps) {
    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const canUpdate = mode === 'target' && !!cfg.next;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-white/20 transition-all"
        >
            <div className="flex items-start justify-between flex-wrap gap-4">
                {/* Info esquerda */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                            #{String(order.estimate_id).substring(0, 8).toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-600">
                            {new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">
                                {mode === 'target' ? 'Empresa Origem' : 'Empresa Destino'}
                            </p>
                            <p className="text-white font-bold text-sm truncate max-w-[150px]">
                                {mode === 'target' ? (order.origin_name || 'Instalador') : (order.target_name || 'Fábrica')}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Cliente</p>
                            <p className="text-white font-bold text-sm truncate max-w-[120px]">{order.client_name || '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Total m²</p>
                            <p className="text-blue-400 font-black">{parseFloat(order.total_metros || 0).toFixed(2)} m²</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Valor</p>
                            <p className="text-green-400 font-black">R$ {parseFloat(order.total_valor || 0).toFixed(2)}</p>
                        </div>
                    </div>

                    {order.notes && (
                        <p className="text-xs text-slate-400 mt-2 bg-white/5 rounded-xl px-3 py-2">
                            📝 {order.notes}
                        </p>
                    )}
                </div>

                {/* Ação direita — apenas empresa de dobra pode avançar status */}
                {canUpdate && (
                    <button
                        onClick={() => onUpdateStatus(order.id, cfg.next!)}
                        disabled={updating}
                        className="px-5 py-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-bold rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 active:scale-[0.97] whitespace-nowrap"
                    >
                        {updating ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                        {cfg.nextLabel}
                    </button>
                )}

                {!canUpdate && mode === 'origin' && order.status !== 'delivered' && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs px-4 py-2 bg-white/5 rounded-2xl">
                        <AlertCircle className="w-4 h-4" />
                        Aguardando a fábrica
                    </div>
                )}
            </div>
        </motion.div>
    );
}
