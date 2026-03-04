import React, { useState } from 'react';
import {
    Search, Calendar, DollarSign, Download, Clock, CheckCircle,
    AlertCircle, Eye, RefreshCcw, Hammer, XCircle, Plus,
    FileText, Package, CheckCircle2, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'Rascunho', color: 'bg-slate-100 text-slate-500', icon: Clock },
    sent: { label: 'Enviado', color: 'bg-blue-100 text-blue-600', icon: Eye },
    approved: { label: 'Pronto para Envio', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    in_production: { label: 'Em Produção', color: 'bg-purple-100 text-purple-700', icon: Hammer },
    paid: { label: 'Pago', color: 'bg-green-500 text-white', icon: CheckCircle2 },
    partial: { label: 'Pago Parcial', color: 'bg-amber-500 text-white', icon: DollarSign },
    expired: { label: 'Expirado', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle },
    canceled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle },
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

    const handleReopen = async (id: string) => {
        if (!confirm('Deseja reabrir este orçamento? O registro financeiro pendente será removido.')) return;
        const res = await fetch(`/api/quotes/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending' }),
            credentials: 'include'
        });
        if (res.ok) { showToast('Orçamento reaberto!', 'success'); fetchData(true); }
    };

    const handleNewVersion = async (id: string) => {
        if (!confirm('Criar uma nova versão?\nO orçamento atual será cancelado e o saldo pago será transferido como crédito.')) return;
        const res = await fetch(`/api/quotes/${id}/new-version`, { method: 'POST', credentials: 'include' });
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
            showToast('Valor não pode ser maior que o saldo restante.', 'error');
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

    const filters = [
        { id: 'all', label: 'Todos' },
        { id: 'draft', label: 'Rascunhos' },
        { id: 'approved', label: 'Aprovados' },
        { id: 'paid', label: 'Pagos' },
        { id: 'cancelled', label: 'Cancelados' },
    ];

    const fmt = (v: number) => `R$ ${(Number(v) || 0).toFixed(2)}`;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header & Search */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-primary/10 rounded-2xl">
                            <FileText className="w-6 h-6 text-brand-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Central de Orçamentos</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Gestão Operacional</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                placeholder="Filtrar por nome ou código..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-11 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all w-72 shadow-inner"
                            />
                        </div>
                        <button onClick={() => navigate('/orcamento')} className="bg-brand-primary text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-brand-primary/20 cursor-pointer">
                            <Plus className="w-4 h-4" /> Novo Pedido
                        </button>
                    </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-3 mt-8 overflow-x-auto pb-2 scrollbar-none">
                    {filters.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setActiveFilter(f.id)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black transition-all whitespace-nowrap border cursor-pointer
                                ${activeFilter === f.id
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                        >
                            {f.label}
                            {activeFilter === f.id && <span className="ml-1 opacity-60">{f.id === 'all' ? quotes.length : getCount(f.id)}</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-8 py-4">Cliente / Código</th>
                                <th className="px-8 py-4">Data</th>
                                <th className="px-8 py-4">Valor Total</th>
                                <th className="px-8 py-4">Status</th>
                                <th className="px-8 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(q => {
                                const st = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
                                const hasPaid = (q.fin_paid || 0) > 0;
                                const canReopen = (q.status === 'approved' || q.status === 'sent') && !hasPaid;
                                const showNewVersion = (q.status === 'approved' || q.status === 'paid' || q.status === 'partial') && hasPaid;

                                return (
                                    <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5 flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${st.color} bg-opacity-10 text-slate-900 flex-shrink-0`}>
                                                <st.icon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-black text-slate-900 truncate text-sm">{q.clientName || 'Cliente'}</h4>
                                                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">ORC-{q.id.substring(0, 8).toUpperCase()}</p>
                                            </div>
                                        </td>

                                        <td className="px-8 py-5 text-slate-500 text-xs font-bold">
                                            {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                                        </td>

                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-slate-700">R$ {parseFloat(q.finalValue || q.totalValue || 0).toFixed(2)}</p>
                                            {hasPaid && (
                                                <p className="text-[9px] font-bold text-emerald-500 uppercase">Pago: R$ {parseFloat(q.fin_paid).toFixed(2)}</p>
                                            )}
                                        </td>

                                        <td className="px-8 py-5">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight ${st.color}`}>
                                                <div className="w-1 h-1 rounded-full bg-current" />
                                                {st.label}
                                            </span>
                                        </td>

                                        <td className="px-8 py-5">
                                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {(q.status === 'draft' || q.status === 'sent') && (
                                                    <>
                                                        <button onClick={() => handleApprove(q.id)} title="Aprovar Orçamento"
                                                            className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl hover:bg-brand-primary hover:text-white transition-all cursor-pointer">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleCancel(q.id)} title="Cancelar"
                                                            className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all cursor-pointer">
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}

                                                {canReopen && (
                                                    <button onClick={() => handleReopen(q.id)} title="Reabrir (Rascunho)"
                                                        className="p-2.5 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all cursor-pointer">
                                                        <RefreshCcw className="w-4 h-4" />
                                                    </button>
                                                )}

                                                {showNewVersion && (
                                                    <button onClick={() => handleNewVersion(q.id)} title="Criar Nova Versão"
                                                        className="p-2.5 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-600 hover:text-white transition-all cursor-pointer">
                                                        <RefreshCcw className="w-4 h-4" />
                                                    </button>
                                                )}

                                                <button onClick={() => openPayModal(q)} title="Registrar Pagamento"
                                                    className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all cursor-pointer">
                                                    <DollarSign className="w-4 h-4" />
                                                </button>

                                                <button onClick={() => navigate(`/orcamento?${(q.status === 'draft' || q.status === 'sent') ? 'edit' : 'view'}=${q.id}`)}
                                                    className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all cursor-pointer">
                                                    <Eye className="w-4 h-4" />
                                                </button>

                                                <button onClick={() => window.open(`/api/reports/client/${q.id}`, '_blank')}
                                                    className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all cursor-pointer">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3.5rem] border border-dashed border-slate-200 shadow-sm">
                    <Package className="w-12 h-12 text-slate-200 mb-4" />
                    <p className="text-slate-400 font-black text-sm uppercase tracking-widest">Nenhum orçamento encontrado</p>
                </div>
            )}

            {/* PAYMENT MODAL (Identical to ReceivablesTab) */}
            <AnimatePresence>
                {payModalQuote && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative">

                            <div className="absolute top-0 right-0 p-6">
                                <button type="button" onClick={() => setPayModalQuote(null)}
                                    className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl cursor-pointer hover:bg-slate-200 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <h3 className="text-2xl font-black text-slate-900 mb-1">Registrar Pagamento</h3>
                            <p className="text-slate-400 text-sm mb-8 font-medium">Orçamento #{String(payModalQuote.id).substring(0, 8)} • {payModalQuote.clientName}</p>

                            <form onSubmit={handlePaySubmit} className="space-y-6">
                                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex justify-between items-center mb-6">
                                    <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Saldo Restante</span>
                                    <span className="text-2xl font-black text-brand-primary">{fmt(payModalQuote.fin_remaining ?? payModalQuote.finalValue ?? payModalQuote.totalValue)}</span>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Valor do Pagamento</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg">R$</span>
                                        <input type="number" step="0.01" min="0.01" required autoFocus
                                            value={payForm.valor_pago} onChange={e => setPayForm({ ...payForm, valor_pago: e.target.value })}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-xl font-black text-slate-900 outline-none focus:border-brand-primary transition-all shadow-inner" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Data</label>
                                        <div className="relative">
                                            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                            <input type="date" required value={payForm.data_pagamento} onChange={e => setPayForm({ ...payForm, data_pagamento: e.target.value })}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-brand-primary transition-all appearance-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Forma</label>
                                        <select value={payForm.forma_pagamento} onChange={e => setPayForm({ ...payForm, forma_pagamento: e.target.value })} required
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black text-slate-700 outline-none focus:border-brand-primary transition-all appearance-none cursor-pointer">
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

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Observação</label>
                                    <textarea rows={2} placeholder="Ex: Pagamento parcial referente ao sinal..."
                                        value={payForm.observacao} onChange={e => setPayForm({ ...payForm, observacao: e.target.value })}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 outline-none focus:border-brand-primary transition-all resize-none shadow-inner" />
                                </div>

                                <div className="pt-4">
                                    <button type="submit" disabled={paying}
                                        className="w-full bg-brand-primary text-white py-5 rounded-[1.5rem] font-black text-sm shadow-xl shadow-brand-primary/20 hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer">
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
