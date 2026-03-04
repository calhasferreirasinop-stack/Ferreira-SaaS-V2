import React, { useState, useMemo } from 'react';
import {
    Search, Calendar, DollarSign, Download, Clock, CheckCircle2,
    AlertCircle, Eye, RefreshCcw, Hammer, XCircle, Plus,
    Filter, ChevronDown, MoreHorizontal, ArrowUpDown, ChevronRight, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    draft: { label: 'Rascunho', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
    sent: { label: 'Enviado', color: 'text-blue-600', bg: 'bg-blue-50', icon: Eye },
    approved: { label: 'Aprovado', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
    in_production: { label: 'Em Produção', color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Hammer },
    paid: { label: 'Pago', color: 'text-teal-600', bg: 'bg-teal-50', icon: CheckCircle2 },
    partial: { label: 'Pago Parcial', color: 'text-cyan-600', bg: 'bg-cyan-50', icon: DollarSign },
    expired: { label: 'Expirado', color: 'text-orange-600', bg: 'bg-orange-50', icon: AlertCircle },
    cancelled: { label: 'Cancelado', color: 'text-rose-600', bg: 'bg-rose-50', icon: XCircle },
    canceled: { label: 'Cancelado', color: 'text-rose-600', bg: 'bg-rose-50', icon: XCircle },
};

const FIN_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    pendente: { label: 'Pendente', color: 'text-rose-600', bg: 'bg-rose-50/50' },
    parcial: { label: 'Parcial', color: 'text-amber-600', bg: 'bg-amber-50/50' },
    pago: { label: 'Pago', color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
};

interface QuotesTabProps {
    quotes: any[];
    fetchData: (s?: boolean) => void;
    showToast: (m: string, t: 'success' | 'error') => void;
}

export default function QuotesTab({ quotes, fetchData, showToast }: QuotesTabProps) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [finStatusFilter, setFinStatusFilter] = useState('all');
    const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'date' | 'value'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Payment Modal State
    const [payModalQuote, setPayModalQuote] = useState<any>(null);
    const [payForm, setPayForm] = useState({
        valor_pago: '',
        data_pagamento: new Date().toISOString().split('T')[0],
        forma_pagamento: '',
        observacao: ''
    });
    const [paying, setPaying] = useState(false);

    const filtered = useMemo(() => {
        return quotes.filter(q => {
            const matchesSearch = (q.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.id || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || q.status === statusFilter;

            const hasPaid = (q.fin_paid || 0) > 0;
            const finKey = q.fin_remaining === 0 ? 'pago' : (hasPaid ? 'parcial' : 'pendente');
            const matchesFin = finStatusFilter === 'all' || finKey === finStatusFilter;

            return matchesSearch && matchesStatus && matchesFin;
        }).sort((a, b) => {
            if (sortBy === 'date') {
                return sortOrder === 'desc'
                    ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            } else {
                const valA = a.finalValue || a.totalValue || 0;
                const valB = b.finalValue || b.totalValue || 0;
                return sortOrder === 'desc' ? valB - valA : valA - valB;
            }
        });
    }, [quotes, searchTerm, statusFilter, finStatusFilter, sortBy, sortOrder]);

    const selectedQuote = quotes.find(q => q.id === selectedQuoteId);

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
        if (!confirm('Reabrir orçamento?')) return;
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
        if (res.ok) { showToast('Nova versão criada!', 'success'); fetchData(true); }
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
            showToast('Valor excede o saldo disponível.', 'error');
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
                showToast('Pagamento registrado com sucesso!', 'success');
                setPayModalQuote(null);
                fetchData(true);
            } else {
                const data = await res.json();
                showToast(data.error || 'Erro ao registrar pagamento', 'error');
            }
        } catch {
            showToast('Erro de conexão com o servidor', 'error');
        } finally {
            setPaying(false);
        }
    };

    const fmt = (v: number) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="flex flex-col h-full font-sans text-slate-700">
            {/* Header / Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex flex-wrap gap-4 items-center shadow-sm">
                <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        placeholder="Buscar por cliente ou Nº orçamento..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                    />
                </div>

                <div className="flex gap-2">
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="appearance-none pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer focus:ring-2 focus:ring-brand-primary/20 outline-none hover:border-slate-300 transition-all"
                        >
                            <option value="all">Todos Status</option>
                            <option value="draft">Rascunho</option>
                            <option value="sent">Enviado</option>
                            <option value="approved">Aprovado</option>
                            <option value="paid">Pago</option>
                            <option value="cancelled">Cancelado</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="relative">
                        <select
                            value={finStatusFilter}
                            onChange={(e) => setFinStatusFilter(e.target.value)}
                            className="appearance-none pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer focus:ring-2 focus:ring-brand-primary/20 outline-none hover:border-slate-300 transition-all"
                        >
                            <option value="all">Financeiro</option>
                            <option value="pendente">Pendente</option>
                            <option value="parcial">Parcial</option>
                            <option value="pago">Pago</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>

                    <button
                        onClick={() => {
                            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
                    >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        {sortBy === 'date' ? 'Data' : 'Valor'}
                    </button>

                    <button
                        onClick={() => navigate('/orcamento')}
                        className="bg-brand-primary text-white pl-3 pr-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 hover:opacity-95 shadow-md shadow-brand-primary/10 transition-all cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        NOVO PEDIDO
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-1 gap-4 overflow-hidden min-h-[600px]">
                {/* List Column */}
                <div className={`flex flex-col flex-1 bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden transition-all duration-500`}>
                    <div className="overflow-x-auto h-full scrollbar-thin scrollbar-thumb-slate-200">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-100">
                                <tr className="text-[10px] uppercase tracking-[0.15em] font-black text-slate-400">
                                    <th className="pl-8 pr-4 py-4 w-24">Nº Orçamento</th>
                                    <th className="px-4 py-4">Cliente</th>
                                    <th className="px-4 py-4 text-center">Data Registro</th>
                                    <th className="px-4 py-4 text-center">Valor Total</th>
                                    <th className="px-4 py-4 text-center">Status</th>
                                    <th className="px-4 py-4 text-center">Financeiro</th>
                                    <th className="pl-4 pr-8 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map(q => {
                                    const st = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
                                    const hasPaid = (q.fin_paid || 0) > 0;
                                    const finKey = q.fin_remaining === 0 ? 'pago' : (hasPaid ? 'parcial' : 'pendente');
                                    const finSt = FIN_STATUS_CONFIG[finKey];
                                    const isSelected = selectedQuoteId === q.id;

                                    return (
                                        <tr
                                            key={q.id}
                                            onClick={() => setSelectedQuoteId(isSelected ? null : q.id)}
                                            className={`group cursor-pointer transition-all duration-300 ${isSelected ? 'bg-brand-primary/[0.03] active-row' : 'hover:bg-slate-50/80'}`}
                                        >
                                            <td className="pl-8 pr-4 py-5">
                                                <span className="text-[11px] font-mono font-black text-slate-400 group-hover:text-brand-primary transition-colors">
                                                    #{q.id.substring(0, 8).toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-brand-primary' : 'bg-transparent'} transition-all`} />
                                                    <h4 className="text-sm font-black text-slate-700 truncate max-w-[200px]">{q.clientName || 'Cliente'}</h4>
                                                </div>
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                                    <Calendar className="w-3.5 h-3.5 opacity-50" />
                                                    {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                                                </div>
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                <span className="text-sm font-black text-slate-800 tracking-tight">{fmt(q.finalValue || q.totalValue || 0)}</span>
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${st.bg} ${st.color}`}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${finSt.bg} ${finSt.color} border border-transparent group-hover:border-current/10 transition-all`}>
                                                    {finSt.label}
                                                </span>
                                            </td>
                                            <td className="pl-4 pr-8 py-5 text-right">
                                                <div className={`inline-flex items-center justify-center p-2 rounded-lg ${isSelected ? 'bg-brand-primary text-white' : 'bg-slate-50 text-slate-300 group-hover:text-slate-400'} transition-all`}>
                                                    {isSelected ? <ChevronRight className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-32 opacity-20">
                                <Package className="w-16 h-16 mb-4" />
                                <p className="font-black uppercase tracking-[0.3em] text-xs">Nenhum registro encontrado</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Action Panel */}
                <AnimatePresence>
                    {selectedQuoteId && selectedQuote && (
                        <motion.div
                            initial={{ x: 400, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 400, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-[400px] bg-white border border-slate-200 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col z-20"
                        >
                            {/* Panel Header */}
                            <div className="p-8 border-b border-slate-100 relative">
                                <button
                                    onClick={() => setSelectedQuoteId(null)}
                                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="mb-6">
                                    <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-1 block">Detalhes da Seleção</span>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight truncate">{selectedQuote.clientName}</h3>
                                    <p className="text-xs font-bold text-slate-400 font-mono mt-1">ID: #{selectedQuote.id.substring(0, 12).toUpperCase()}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-2xl">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                                        <p className="text-lg font-black text-slate-900 tracking-tighter">{fmt(selectedQuote.finalValue || selectedQuote.totalValue)}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Devedor</p>
                                        <p className="text-lg font-black text-rose-500 tracking-tighter">{fmt(selectedQuote.fin_remaining ?? selectedQuote.finalValue)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Panel Actions */}
                            <div className="flex-1 p-8 space-y-8 overflow-y-auto scrollbar-thin">
                                {/* Primary Actions */}
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">Ações Principais</h5>
                                    <div className="space-y-3">
                                        {(selectedQuote.status === 'draft' || selectedQuote.status === 'sent') && (
                                            <button
                                                onClick={() => handleApprove(selectedQuote.id)}
                                                className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.1em] hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                                            >
                                                <CheckCircle2 className="w-4 h-4" /> Aprovar Orçamento
                                            </button>
                                        )}

                                        {(selectedQuote.status === 'approved' || selectedQuote.status === 'paid' || selectedQuote.status === 'partial') && (
                                            <button
                                                onClick={() => handleNewVersion(selectedQuote)}
                                                className="w-full flex items-center justify-center gap-3 py-4 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.1em] hover:opacity-90 transition-all shadow-lg shadow-brand-primary/20 cursor-pointer"
                                            >
                                                <RefreshCcw className="w-4 h-4" /> Criar Nova Versão
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Financial Actions */}
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">Pagamento</h5>
                                    <button
                                        onClick={() => openPayModal(selectedQuote)}
                                        className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.1em] hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 cursor-pointer"
                                    >
                                        <DollarSign className="w-4 h-4" /> Registrar Pagamento
                                    </button>
                                </div>

                                {/* Secondary Actions */}
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">Gerenciamento</h5>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(selectedQuote.status === 'approved' && (selectedQuote.fin_paid || 0) === 0) && (
                                            <button
                                                onClick={() => handleReopen(selectedQuote.id, false)}
                                                className="flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-tighter hover:bg-slate-200 transition-all cursor-pointer"
                                            >
                                                <RefreshCcw className="w-3.5 h-3.5" /> Reabrir
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleCancel(selectedQuote.id)}
                                            className="flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-500 rounded-xl font-black text-[10px] uppercase tracking-tighter hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                                        >
                                            <XCircle className="w-3.5 h-3.5" /> Cancelar
                                        </button>

                                        <button
                                            onClick={() => navigate(`/orcamento?view=${selectedQuote.id}`)}
                                            className="flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-tighter hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                                        >
                                            <Eye className="w-3.5 h-3.5" /> Ver Detalhes
                                        </button>

                                        <button
                                            onClick={() => window.open(`/api/reports/client/${selectedQuote.id}`, '_blank')}
                                            className="flex items-center justify-center gap-2 py-3 bg-teal-50 text-teal-600 rounded-xl font-black text-[10px] uppercase tracking-tighter hover:bg-teal-600 hover:text-white transition-all cursor-pointer"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Baixar PDF
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Panel Footer */}
                            <div className="p-6 bg-slate-50 border-t border-slate-100">
                                <button
                                    onClick={() => navigate(`/orcamento?edit=${selectedQuote.id}`)}
                                    className="w-full flex items-center justify-center gap-3 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-[0.1em] hover:border-slate-300 transition-all cursor-pointer shadow-sm"
                                >
                                    <Hammer className="w-4 h-4" /> Editar Orçamento
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Global Payment Modal */}
            <AnimatePresence>
                {payModalQuote && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-2xl relative border border-slate-100">

                            <div className="absolute top-0 right-0 p-8">
                                <button type="button" onClick={() => setPayModalQuote(null)}
                                    className="text-slate-400 hover:text-slate-600 bg-slate-50 rounded-2xl w-12 h-12 flex items-center justify-center font-bold text-xl cursor-pointer hover:bg-slate-100 transition-all">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <h3 className="text-3xl font-black text-slate-900 mb-2 leading-none tracking-tight">Registar Recebimento</h3>
                            <p className="text-slate-400 text-sm mb-10 font-bold uppercase tracking-widest opacity-60">Pedido #{String(payModalQuote.id).substring(0, 8)} • {payModalQuote.clientName}</p>

                            <form onSubmit={handlePaySubmit} className="space-y-8">
                                <div className="bg-brand-primary/[0.03] border border-brand-primary/10 p-6 rounded-[2rem] flex justify-between items-center mb-8">
                                    <span className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em]">Total Restante</span>
                                    <span className="text-3xl font-black text-brand-primary tracking-tighter">{fmt(payModalQuote.fin_remaining ?? payModalQuote.finalValue ?? payModalQuote.totalValue)}</span>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-3 tracking-[0.2em]">Quanto está sendo pago?</label>
                                    <div className="relative">
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl">R$</span>
                                        <input type="number" step="0.01" min="0.01" required autoFocus
                                            value={payForm.valor_pago} onChange={e => setPayForm({ ...payForm, valor_pago: e.target.value })}
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] pl-16 pr-8 py-5 text-2xl font-black text-slate-900 outline-none focus:border-brand-primary/20 focus:bg-white transition-all shadow-inner font-mono" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-3 tracking-[0.2em]">Data do Evento</label>
                                        <input type="date" required value={payForm.data_pagamento} onChange={e => setPayForm({ ...payForm, data_pagamento: e.target.value })}
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] px-6 py-5 text-sm font-black text-slate-700 outline-none focus:border-brand-primary/20 transition-all appearance-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-3 tracking-[0.2em]">Forma</label>
                                        <select value={payForm.forma_pagamento} onChange={e => setPayForm({ ...payForm, forma_pagamento: e.target.value })} required
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] px-6 py-5 text-sm font-black text-slate-700 outline-none focus:border-brand-primary/20 transition-all appearance-none cursor-pointer">
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

                                <div className="pt-6">
                                    <button type="submit" disabled={paying}
                                        className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer"
                                    >
                                        {paying ? 'Processando...' : 'Confirmar Recebimento'}
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
