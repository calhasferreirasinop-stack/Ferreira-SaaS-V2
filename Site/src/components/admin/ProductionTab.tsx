import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Factory, RefreshCw, CheckCircle, PlayCircle, PackageCheck, Truck,
    Clock, AlertCircle, ChevronRight
} from 'lucide-react';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; next?: string; nextLabel?: string }> = {
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock className="w-4 h-4" />, next: 'accepted', nextLabel: '✅ Aceitar' },
    accepted: { label: 'Aceito', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <CheckCircle className="w-4 h-4" />, next: 'in_production', nextLabel: '🏭 Produzir' },
    in_production: { label: 'Em Produção', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: <PlayCircle className="w-4 h-4" />, next: 'ready', nextLabel: '📦 Pronto' },
    ready: { label: 'Pronto', color: 'bg-green-100 text-green-800 border-green-200', icon: <PackageCheck className="w-4 h-4" />, next: 'delivered', nextLabel: '🚛 Entregar' },
    delivered: { label: 'Entregue', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <Truck className="w-4 h-4" /> },
};

interface Props {
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function ProductionTab({ showToast }: Props) {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    useEffect(() => { fetchOrders(); }, []);

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

    const receivedOrders = orders.filter(o => o.side === 'target');

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-20 py-4 border-b border-slate-100">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                        <Factory className="w-6 h-6 text-brand-primary" /> Painel de Produção
                    </h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Acompanhamento e Status das Dobras</p>
                </div>
                <button onClick={fetchOrders} disabled={loading}
                    className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : receivedOrders.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-16 text-center shadow-sm">
                    <Factory className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">Nenhum pedido em produção no momento.</p>
                </div>
            ) : isMobile ? (
                <div className="space-y-4">
                    {receivedOrders.map(order => (
                        <OrderCardMobile key={order.id} order={order} onUpdate={handleUpdateStatus} updating={updating === order.id} />
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Data</th>
                                <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Orçamento</th>
                                <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Cliente</th>
                                <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Medidas</th>
                                <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Status</th>
                                <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {receivedOrders.map(order => (
                                <OrderRow key={order.id} order={order} onUpdate={handleUpdateStatus} updating={updating === order.id} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function OrderCardMobile({ order, onUpdate, updating }: { order: any; onUpdate: (id: string, s: string) => void; updating: boolean }) {
    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    return (
        <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${cfg.color} border border-current/20`}>{cfg.label}</span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">#{String(order.estimate_id).substring(0, 8)}</span>
            </div>
            <div className="space-y-2 mb-6">
                <p className="font-bold text-slate-900">{order.client_name || '—'}</p>
                <div className="flex gap-4 text-xs text-slate-500">
                    <span>📏 {parseFloat(order.total_metros || 0).toFixed(2)} m²</span>
                    <span>💰 R$ {parseFloat(order.total_valor || 0).toFixed(2)}</span>
                </div>
            </div>
            {cfg.next && (
                <button onClick={() => onUpdate(order.id, cfg.next!)} disabled={updating}
                    className="w-full bg-brand-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-50">
                    {updating ? <RefreshCw className="w-5 h-5 animate-spin" /> : cfg.icon} {cfg.nextLabel}
                </button>
            )}
        </div>
    );
}

function OrderRow({ order, onUpdate, updating }: { order: any; onUpdate: (id: string, s: string) => void; updating: boolean }) {
    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    return (
        <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="px-8 py-6 text-sm text-slate-500">
                {new Date(order.created_at).toLocaleDateString('pt-BR')}
            </td>
            <td className="px-8 py-6">
                <span className="text-xs font-mono font-bold text-slate-400">#{String(order.estimate_id).substring(0, 8).toUpperCase()}</span>
            </td>
            <td className="px-8 py-6">
                <p className="font-bold text-slate-900">{order.client_name || '—'}</p>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{order.origin_name || 'Instalador'}</p>
            </td>
            <td className="px-8 py-6">
                <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{parseFloat(order.total_metros || 0).toFixed(2)} m²</span>
                    <span className="text-xs text-green-600 font-bold">R$ {parseFloat(order.total_valor || 0).toFixed(2)}</span>
                </div>
            </td>
            <td className="px-8 py-6">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${cfg.color} border border-current/20`}>
                    {cfg.icon} {cfg.label}
                </span>
            </td>
            <td className="px-8 py-6 text-right">
                {cfg.next && (
                    <button onClick={() => onUpdate(order.id, cfg.next!)} disabled={updating}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-primary/10 hover:shadow-brand-primary/30 transition-all active:scale-95 disabled:opacity-50">
                        {updating ? <RefreshCw className="w-4 h-4 animate-spin" /> : cfg.icon} {cfg.nextLabel}
                    </button>
                )}
            </td>
        </tr>
    );
}
