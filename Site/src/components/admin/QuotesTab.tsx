import React, { useState, useMemo } from 'react';
import {
    Search, Calendar, DollarSign, Download, Clock, CheckCircle2,
    AlertCircle, Eye, RefreshCcw, Hammer, XCircle, Plus,
    Filter, ChevronDown, MoreHorizontal, ArrowUpDown, ChevronRight, X, Package, ClipboardList
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Rascunho', color: 'text-amber-600', bg: 'bg-amber-100' },
    sent: { label: 'Enviado', color: 'text-blue-600', bg: 'bg-blue-100' },
    approved: { label: 'Aprovado', color: 'text-emerald-600', bg: 'bg-green-100' },
    in_production: { label: 'Em Produção', color: 'text-indigo-600', bg: 'bg-indigo-100' },
    paid: { label: 'Pago', color: 'text-teal-600', bg: 'bg-teal-100' },
    partial: { label: 'Pago Parcial', color: 'text-cyan-600', bg: 'bg-cyan-100' },
    expired: { label: 'Expirado', color: 'text-orange-600', bg: 'bg-orange-100' },
    cancelled: { label: 'Cancelado', color: 'text-rose-600', bg: 'bg-red-100' },
    canceled: { label: 'Cancelado', color: 'text-rose-600', bg: 'bg-red-100' },
};

const FIN_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    pendente: { label: 'Pendente', color: 'text-rose-600', bg: 'bg-red-50' },
    parcial: { label: 'Parcial', color: 'text-amber-600', bg: 'bg-amber-50' },
    pago: { label: 'Pago', color: 'text-emerald-600', bg: 'bg-green-50' },
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
                String(q.id).toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || q.status === statusFilter;

            const hasPaid = (q.fin_paid || 0) > 0;
            const finKey = q.fin_remaining === 0 ? 'pago' : (hasPaid ? 'parcial' : 'pendente');
            const matchesFin = finStatusFilter === 'all' || finKey === finStatusFilter;

            return matchesSearch && matchesStatus && matchesFin;
        });
    }, [quotes, searchTerm, statusFilter, finStatusFilter]);

    // Dashboard Stats
    const totalOrcado = quotes.reduce((acc, q) => acc + (q.finalValue || q.totalValue || 0), 0);
    const totalRecebido = quotes.reduce((acc, q) => acc + (q.fin_paid || 0), 0);
    const totalAReceber = quotes.reduce((acc, q) => acc + (q.fin_remaining || (q.status === 'approved' ? (q.finalValue || q.totalValue) : 0)), 0);

    const handleApprove = async (id: string) => {
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
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ClipboardList className="w-6 h-6 text-brand-primary" /> Central de Orçamentos
                </h2>
                <button
                    onClick={() => navigate('/orcamento')}
                    className="bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm cursor-pointer"
                >
                    <Plus className="w-5 h-5" /> NOVO ORÇAMENTO
                </button>
            </div>

            {/* DASHBOARD (Receivables Style) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Orçado</p>
                        <p className="text-2xl font-black text-slate-900">{fmt(totalOrcado)}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Recebido</p>
                        <p className="text-2xl font-black text-green-600">{fmt(totalRecebido)}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Saldo a Receber</p>
                        <p className="text-2xl font-black text-amber-600">{fmt(totalAReceber)}</p>
                    </div>
                </div>
            </div>

            {/* BARRA DE FILTROS (Receivables Style) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                <div className="flex flex-wrap gap-2">
                    {['all', 'draft', 'sent', 'approved', 'cancelled'].map(f => (
                        <button key={f} onClick={() => setStatusFilter(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${statusFilter === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {f === 'all' ? 'Todos' : STATUS_CONFIG[f]?.label || f}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Buscar por cliente ou Nº orçamento..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
            </div>

            {/* LISTAGEM (Receivables Style) */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase">
                            <tr>
                                <th className="px-6 py-4">Cliente / Orçamento</th>
                                <th className="px-6 py-4">Valor Total</th>
                                <th className="px-6 py-4">Data Registro</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center">Financeiro</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-slate-400 font-medium">Nenhum orçamento encontrado.</td></tr>
                            ) : (
                                filtered.map(q => {
                                    const st = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
                                    const hasPaid = (q.fin_paid || 0) > 0;
                                    const finKey = q.fin_remaining === 0 ? 'pago' : (hasPaid ? 'parcial' : 'pendente');
                                    const finSt = FIN_STATUS_CONFIG[finKey];
                                    const isApproved = ['approved', 'paid', 'partial', 'in_production'].includes(q.status);

                                    return (
                                        <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-900">{q.clientName || 'Cliente'}</p>
                                                <p className="text-xs text-slate-400 font-mono">#{String(q.id).substring(0, 8).toUpperCase()}</p>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-700">{fmt(q.finalValue || q.totalValue)}</td>
                                            <td className="px-6 py-4 text-slate-500">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 opacity-40" />
                                                    {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`${st.bg} ${st.color} px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight`}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className={`${finSt.bg} ${finSt.color} px-2 py-0.5 rounded text-[9px] font-bold uppercase`}>
                                                        {finSt.label}
                                                    </span>
                                                    {hasPaid && (
                                                        <span className="text-[9px] text-slate-400 font-bold mt-0.5 leading-none">
                                                            {fmt(q.fin_paid)} pagos
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-3">
                                                    {/* LADO ESQUERDO: Aprovar / Reabrir / Nova Versão */}
                                                    <div className="flex-1 flex items-center gap-2">
                                                        {q.status !== 'cancelled' && (
                                                            <>
                                                                {/* Aprovar - Rascunho/Enviado */}
                                                                {(q.status === 'draft' || q.status === 'sent') ? (
                                                                    <button
                                                                        onClick={() => handleApprove(q.id)}
                                                                        className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-emerald-600 transition-all shadow-sm cursor-pointer"
                                                                    >
                                                                        Aprovar Orçamento
                                                                    </button>
                                                                ) : (
                                                                    /* Reabrir - No lugar do Aprovar após aprovado */
                                                                    (['approved', 'partial', 'paid', 'in_production'].includes(q.status)) && (
                                                                        <button
                                                                            onClick={() => handleReopen(q.id, hasPaid)}
                                                                            className="bg-slate-400 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-500 transition-all shadow-sm cursor-pointer"
                                                                        >
                                                                            Reabrir Orçamento
                                                                        </button>
                                                                    )
                                                                )}

                                                                {/* Nova Versão - Somente se já tiver pago algo */}
                                                                {hasPaid && (
                                                                    <button
                                                                        onClick={() => handleNewVersion(q)}
                                                                        className="bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-black uppercase hover:bg-blue-600 transition-all shadow-sm cursor-pointer"
                                                                        title="Nova Versão"
                                                                    >
                                                                        <RefreshCcw className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* LADO DIREITO: Registrar / Cancelar / Relatórios */}
                                                    <div className="flex items-center gap-2">
                                                        {q.status !== 'cancelled' ? (
                                                            <>
                                                                {/* Cancelar (Antes do Registrar) */}
                                                                <button
                                                                    onClick={() => handleCancel(q.id)}
                                                                    className="text-rose-500 p-2 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                                                    title="Cancelar"
                                                                >
                                                                    <XCircle className="w-5 h-5" />
                                                                </button>

                                                                {/* Registrar Pagamento */}
                                                                {(['approved', 'partial', 'in_production'].includes(q.status) && (q.fin_remaining > 0 || q.fin_remaining === undefined)) && (
                                                                    <button
                                                                        onClick={() => openPayModal(q)}
                                                                        className="bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-orange-600 transition-all shadow-sm cursor-pointer"
                                                                    >
                                                                        Registrar Pagamento
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-full uppercase">Cancelado</span>
                                                        )}

                                                        {/* Relatórios (Sempre Visíveis) */}
                                                        <div className="flex items-center gap-1 border-l border-slate-100 pl-2 ml-1">
                                                            <button
                                                                onClick={() => navigate(`/orcamento?view=${q.id}`)}
                                                                className="text-slate-400 p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                                                                title="Ver Detalhes"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => window.open(`/api/reports/client/${q.id}`, '_blank')}
                                                                className="text-slate-400 p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                                                                title="Download PDF"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL PAGAMENTO (Receivables Style) */}
            <AnimatePresence>
                {payModalQuote && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl relative border border-slate-100">

                            <div className="absolute top-0 right-0 p-6">
                                <button type="button" onClick={() => setPayModalQuote(null)}
                                    className="text-slate-400 hover:text-slate-600 bg-slate-50 rounded-full w-10 h-10 flex items-center justify-center font-bold pb-1 text-xl cursor-pointer hover:bg-slate-100 transition-all">
                                    ×
                                </button>
                            </div>

                            <h3 className="text-2xl font-black text-slate-900 mb-1">Registrar Pagamento</h3>
                            <p className="text-slate-400 text-sm mb-8 font-bold uppercase tracking-widest opacity-60">Pedido #{String(payModalQuote.id).substring(0, 8)} • {payModalQuote.clientName}</p>

                            <form onSubmit={handlePaySubmit} className="space-y-6">
                                <div className="bg-brand-primary/[0.03] border border-brand-primary/10 p-5 rounded-2xl flex justify-between items-center mb-6">
                                    <span className="text-slate-600 font-bold uppercase text-xs">Total Restante</span>
                                    <span className="text-2xl font-black text-brand-primary tracking-tight">{fmt(payModalQuote.fin_remaining ?? payModalQuote.finalValue ?? payModalQuote.totalValue)}</span>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-2 tracking-wider">Valor do Recebimento</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg">R$</span>
                                        <input type="number" step="0.01" min="0.01" required autoFocus
                                            value={payForm.valor_pago} onChange={e => setPayForm({ ...payForm, valor_pago: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-14 pr-6 py-4 text-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all shadow-inner font-mono" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-2 tracking-wider">Data do Evento</label>
                                        <input type="date" required value={payForm.data_pagamento} onChange={e => setPayForm({ ...payForm, data_pagamento: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-2 tracking-wider">Forma</label>
                                        <select value={payForm.forma_pagamento} onChange={e => setPayForm({ ...payForm, forma_pagamento: e.target.value })} required
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all cursor-pointer">
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

                                <div className="pt-4">
                                    <button type="submit" disabled={paying}
                                        className="w-full bg-slate-900 text-white py-4.5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer"
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
