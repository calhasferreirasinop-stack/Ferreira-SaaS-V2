import React, { useState } from 'react';
import {
    Search, Calendar, DollarSign, Download, Clock, CheckCircle2,
    AlertCircle, Eye, RefreshCcw, Hammer, XCircle, Plus,
    FileText, Package, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CONFIG: Record<string, { label: string; color: string; lightColor: string; icon: any }> = {
    draft: { label: 'Rascunho', color: 'bg-amber-400', lightColor: 'bg-amber-50 text-amber-600', icon: Clock },
    sent: { label: 'Enviado', color: 'bg-blue-400', lightColor: 'bg-blue-50 text-blue-600', icon: Eye },
    approved: { label: 'Aprovado', color: 'bg-teal-500', lightColor: 'bg-teal-50 text-teal-700', icon: CheckCircle2 },
    in_production: { label: 'Em Produção', color: 'bg-blue-600', lightColor: 'bg-blue-50 text-blue-700', icon: Hammer },
    paid: { label: 'Pago', color: 'bg-emerald-500', lightColor: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
    partial: { label: 'Pago Parcial', color: 'bg-cyan-500', lightColor: 'bg-cyan-50 text-cyan-700', icon: DollarSign },
    expired: { label: 'Expirado', color: 'bg-orange-500', lightColor: 'bg-orange-50 text-orange-700', icon: AlertCircle },
    cancelled: { label: 'Cancelado', color: 'bg-rose-400', lightColor: 'bg-rose-50 text-rose-600', icon: XCircle },
    canceled: { label: 'Cancelado', color: 'bg-rose-400', lightColor: 'bg-rose-50 text-rose-600', icon: XCircle },
};

const FIN_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pendente: { label: 'Pendente', color: 'bg-rose-50 text-rose-600 border border-rose-100' },
    parcial: { label: 'Parcial', color: 'bg-amber-50 text-amber-600 border border-amber-100' },
    pago: { label: 'Pago', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
};

interface QuotesTabProps {
    quotes: any[];
    fetchData: (s?: boolean) => void;
    showToast: (m: string, t: 'success' | 'error') => void;
}

export default function QuotesTab({ quotes, fetchData, showToast }: QuotesTabProps) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    // Payment Modal State
    const [payModalQuote, setPayModalQuote] = useState<any>(null);
    const [payForm, setPayForm] = useState({
        valor_pago: '',
        data_pagamento: new Date().toISOString().split('T')[0],
        forma_pagamento: '',
        observacao: ''
    });
    const [paying, setPaying] = useState(false);

    const filtered = quotes.filter(q => {
        const matchesSearch = (q.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (q.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = activeFilter === 'all' || q.status === activeFilter;
        return matchesSearch && matchesFilter;
    });

    const getCount = (status: string) => quotes.filter(q => q.status === status).length;

    const handleApprove = async (id: string) => {
        if (!confirm('Deseja aprovar este orçamento? Isso gerará automaticamente um registro financeiro.')) return;
        const res = await fetch(`/api/quotes/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' }),
            credentials: 'include'
        });
        if (res.ok) { showToast('Orçamento aprovado!', 'success'); fetchData(true); }
    };

    const handleReopen = async (id: string, hasPaid: boolean) => {
        if (hasPaid) {
            alert('Não é possível reabrir um orçamento com pagamentos. Use "Nova Versão".');
            return;
        }
        if (!confirm('Reabrir orçamento? O registro financeiro pendente será removido.')) return;
        const res = await fetch(`/api/quotes/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending' }),
            credentials: 'include'
        });
        if (res.ok) { showToast('Orçamento reaberto!', 'success'); fetchData(true); }
    };

    const handleNewVersion = async (q: any) => {
        if (!confirm(`Deseja criar uma nova versão?\nO crédito de ${fmt(q.fin_paid)} será transferido.`)) return;
        const res = await fetch(`/api/quotes/${q.id}/new-version`, { method: 'POST', credentials: 'include' });
        if (res.ok) { showToast('Nova versão criada com crédito!', 'success'); fetchData(true); }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('Deseja cancelar este orçamento?')) return;
        const res = await fetch(`/api/quotes/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' }),
            credentials: 'include'
        });
        if (res.ok) { showToast('Orçamento cancelado.', 'success'); fetchData(true); }
    };

    const openPayModal = (q: any) => {
        const saldo = q.fin_remaining ?? q.finalValue ?? q.totalValue;
        setPayModalQuote(q);
        setPayForm({
            valor_pago: String(saldo),
            data_pagamento: new Date().toISOString().split('T')[0],
            forma_pagamento: '',
            observacao: ''
        });
    };

    const handlePaySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payModalQuote) return;

        const arId = payModalQuote.fin_id || payModalQuote.id;
        const valParsed = parseFloat(payForm.valor_pago.replace(',', '.'));
        const saldoMax = payModalQuote.fin_remaining ?? payModalQuote.finalValue ?? payModalQuote.totalValue;

        if (valParsed > parseFloat(saldoMax) + 0.01) {
            showToast('Valor excede o saldo.', 'error');
            return;
        }

        setPaying(true);
        try {
            const res = await fetch(`/api/financial/receivables/${arId}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payForm, valor_pago: valParsed }),
                credentials: 'include'
            });
            if (res.ok) {
                showToast('Pagamento registrado!', 'success');
                setPayModalQuote(null);
                fetchData(true);
            } else {
                const data = await res.json();
                showToast(data.error || 'Erro ao pagar', 'error');
            }
        } catch {
            showToast('Erro de conexão', 'error');
        } finally {
            setPaying(false);
        }
    };

    const fmt = (v: number) => `R$ ${(Number(v) || 0).toFixed(2)}`;

    const summaryCards = [
        { label: 'Aguardando', count: getCount('draft') + getCount('sent'), color: 'bg-amber-100 text-amber-600', filter: 'draft' },
        { label: 'Aprovado', count: getCount('approved'), color: 'bg-teal-100 text-teal-600', filter: 'approved' },
        { label: 'Pago', count: getCount('paid') + getCount('partial'), color: 'bg-emerald-100 text-emerald-600', filter: 'paid' },
        { label: 'Em Produção', count: getCount('in_production'), color: 'bg-blue-100 text-blue-600', filter: 'in_production' },
        { label: 'Realizado', count: 0, color: 'bg-indigo-100 text-indigo-600', filter: 'all' },
        { label: 'Cancelado', count: getCount('cancelled') + getCount('canceled'), color: 'bg-rose-100 text-rose-600', filter: 'cancelled' },
    ];

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-20 font-sans tracking-tight">
            {/* Top Summary Cards (Compact) */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                {summaryCards.map((card, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveFilter(card.filter)}
                        className={`p-3 rounded-xl flex flex-col items-center justify-center transition-all border-2 cursor-pointer
                        ${card.color} ${activeFilter === card.filter ? 'border-current shadow-sm' : 'border-transparent hover:scale-[1.02]'}`}
                    >
                        <span className="text-xl font-black">{card.count}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-80 leading-none">{card.label}</span>
                    </button>
                ))}
            </div>

            {/* Header & Search (Compact) */}
            <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3 items-center">
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                        placeholder="Buscar orçamentos..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 pr-6 py-2 bg-slate-50 border-none rounded-xl text-xs w-full shadow-inner focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => navigate('/orcamento')} className="bg-brand-primary text-white px-5 py-2 rounded-xl font-black text-[10px] flex items-center justify-center gap-1.5 hover:opacity-90 transition-all shadow-sm cursor-pointer flex-1 md:flex-none uppercase tracking-widest">
                        <Plus className="w-3.5 h-3.5" /> Novo Pedido
                    </button>
                    {activeFilter !== 'all' && (
                        <button onClick={() => setActiveFilter('all')} className="bg-slate-900 text-white px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:opacity-90 transition-all cursor-pointer shadow-sm">
                            Todos
                        </button>
                    )}
                </div>
            </div>

            {/* Quotes List (Compact One-Line Column Layout) */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <th className="px-6 py-3">Cliente / Código</th>
                                <th className="px-4 py-3 text-center">Data</th>
                                <th className="px-4 py-3 text-center">Valor Total</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(q => {
                                const st = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
                                const hasPaid = (q.fin_paid || 0) > 0;
                                const finStKey = q.fin_remaining === 0 ? 'pago' : (hasPaid ? 'parcial' : 'pendente');
                                const finSt = FIN_STATUS_CONFIG[finStKey];
                                const isApproved = q.status === 'approved' || q.status === 'paid' || q.status === 'partial' || q.status === 'in_production';

                                return (
                                    <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${st.lightColor} flex-shrink-0`}>
                                                    <st.icon className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs font-black text-slate-800 truncate leading-tight">{q.clientName || 'Cliente'}</h4>
                                                    <p className="text-[9px] font-bold text-slate-300 font-mono">#{q.id.substring(0, 8).toUpperCase()}</p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-center text-slate-500 text-[10px] font-bold">
                                            {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <p className="text-xs font-black text-slate-800 leading-tight">{fmt(q.finalValue || q.totalValue || 0)}</p>
                                            {hasPaid && (
                                                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Pago {fmt(q.fin_paid)}</p>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tight whitespace-nowrap ${st.lightColor}`}>
                                                    {st.label}
                                                </span>
                                                {isApproved && (
                                                    <span className={`px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest ${finSt.color}`}>
                                                        {finSt.label}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-6 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Action 1: Aprovar / Reabrir / Nova Versão */}
                                                {(q.status === 'draft' || q.status === 'sent') ? (
                                                    <button onClick={() => handleApprove(q.id)} className="bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase hover:bg-emerald-600 transition-all cursor-pointer shadow-sm">
                                                        Aprovar
                                                    </button>
                                                ) : isApproved && (
                                                    hasPaid ? (
                                                        <button onClick={() => handleNewVersion(q)} className="bg-blue-500 text-white px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase hover:bg-blue-600 transition-all cursor-pointer shadow-sm">
                                                            Nova Versão
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => handleReopen(q.id, false)} className="bg-blue-100 text-blue-600 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all cursor-pointer shadow-sm">
                                                            Reabrir
                                                        </button>
                                                    )
                                                )}

                                                {/* Action 2: Pagar (Laranja) */}
                                                <button onClick={() => openPayModal(q)} className="bg-brand-primary text-white px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase hover:opacity-90 transition-all cursor-pointer shadow-sm">
                                                    Pagar
                                                </button>

                                                {/* Action 3: Utilities */}
                                                <div className="flex gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleCancel(q.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-all" title="Cancelar">
                                                        <XCircle className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => navigate(`/orcamento?view=${q.id}`)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer transition-all" title="Ver">
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => window.open(`/api/reports/client/${q.id}`, '_blank')} className="p-1.5 text-brand-primary hover:bg-brand-primary/5 rounded-lg cursor-pointer transition-all" title="PDF">
                                                        <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Empty State */}
            {filtered.length === 0 && (
                <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-100">
                    <p className="text-slate-300 font-bold text-[9px] uppercase tracking-widest">Nenhum registro</p>
                </div>
            )}

            {/* Payment Modal */}
            <AnimatePresence>
                {payModalQuote && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative border border-slate-100">

                            <div className="absolute top-0 right-0 p-5">
                                <button type="button" onClick={() => setPayModalQuote(null)}
                                    className="text-slate-400 hover:text-slate-600 bg-slate-50 rounded-xl w-8 h-8 flex items-center justify-center font-bold text-lg cursor-pointer transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <h3 className="text-xl font-black text-slate-900 mb-1 leading-tight">Registrar Pagamento</h3>
                            <p className="text-slate-400 text-[9px] mb-6 font-bold uppercase tracking-widest">ORC-#{String(payModalQuote.id).substring(0, 8)}</p>

                            <form onSubmit={handlePaySubmit} className="space-y-4">
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex justify-between items-center">
                                    <span className="text-slate-400 font-black uppercase text-[8px] tracking-widest">Saldo Restante</span>
                                    <span className="text-xl font-black text-brand-primary">{fmt(payModalQuote.fin_remaining ?? payModalQuote.finalValue ?? payModalQuote.totalValue)}</span>
                                </div>

                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Valor do Pagamento</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black">R$</span>
                                        <input type="number" step="0.01" min="0.01" required autoFocus
                                            value={payForm.valor_pago} onChange={e => setPayForm({ ...payForm, valor_pago: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 text-lg font-black text-slate-900 outline-none focus:border-brand-primary" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Data</label>
                                        <input type="date" required value={payForm.data_pagamento} onChange={e => setPayForm({ ...payForm, data_pagamento: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-700 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Forma</label>
                                        <select value={payForm.forma_pagamento} onChange={e => setPayForm({ ...payForm, forma_pagamento: e.target.value })} required
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-700 outline-none cursor-pointer">
                                            <option value="">Selecione...</option>
                                            <option value="pix">PIX</option>
                                            <option value="dinheiro">Dinheiro</option>
                                            <option value="cartao_credito">Cartão de Crédito</option>
                                            <option value="cartao_debito">Cartão de Débito</option>
                                            <option value="boleto">Boleto</option>
                                            <option value="transferencia">Transferência</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button type="submit" disabled={paying}
                                        className="w-full bg-brand-primary text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-primary/10 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer">
                                        {paying ? 'Processando...' : 'Confirmar Pagamento'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
