import React, { useState, useMemo } from 'react';
import {
    Search, Calendar, DollarSign, Download, Clock, CheckCircle2,
    AlertCircle, Eye, RefreshCcw, Hammer, XCircle, Plus, RotateCcw,
    Filter, ChevronDown, MoreHorizontal, ArrowUpDown, ChevronRight, X, Package, ClipboardList,
    PenLine, FileDown, Printer
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

    // Payment e New Version Modal State
    const [payModalQuote, setPayModalQuote] = useState<any>(null);
    const [newVersionQuote, setNewVersionQuote] = useState<any>(null);
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
            const hasCredit = (q.fin_credit || 0) > 0;
            const fallbackRestante = (q.finalValue || q.totalValue || 0) - (q.fin_paid || 0) - (q.fin_credit || 0);
            const valRestante = q.fin_remaining !== null && q.fin_remaining !== undefined ? q.fin_remaining : Math.max(0, fallbackRestante);

            const isTotalPaid = valRestante < 0.01 && (hasPaid || hasCredit);
            const finKey = isTotalPaid ? 'pago' : (hasPaid || hasCredit ? 'parcial' : 'pendente');
            const matchesFin = finStatusFilter === 'all' || finKey === finStatusFilter;

            return matchesSearch && matchesStatus && matchesFin;
        });
    }, [quotes, searchTerm, statusFilter, finStatusFilter]);

    // Dashboard Stats
    const totalOrcado = quotes.reduce((acc, q) => acc + (q.finalValue || q.totalValue || 0), 0);
    const totalRecebido = quotes.reduce((acc, q) => acc + (q.fin_paid || 0), 0);
    const totalAReceber = quotes.reduce((acc, q) => acc + (q.fin_remaining ?? (['approved', 'partial', 'in_production', 'paid'].includes(q.status) ? (q.finalValue || q.totalValue) : 0)), 0);

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
            showToast('Não é possível reabrir um orçamento com pagamentos. Use "Nova Versão".', 'error');
            return;
        }
        const res = await fetch(`/api/quotes/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'draft' }),
            credentials: 'include'
        });
        if (res.ok) { showToast('Orçamento reaberto!', 'success'); fetchData(true); }
    };

    const confirmNewVersion = async () => {
        if (!newVersionQuote) return;
        const q = newVersionQuote;
        const hasPaid = (q.fin_paid || 0) > 0;

        const res = await fetch(`/api/quotes/${q.id}/new-version`, { method: 'POST', credentials: 'include' });
        if (res.ok) {
            showToast(hasPaid ? 'Nova versão criada! Crédito financeiro transferido.' : 'Nova versão criada!', 'success');
            fetch('/api/maintenance/cleanup-financial', { method: 'POST', credentials: 'include' }).catch(() => { });
            fetchData(true);
            setNewVersionQuote(null);
        } else {
            const err = await res.json();
            showToast(err.error || 'Erro ao criar nova versão', 'error');
        }
    };

    const handleNewVersionClick = (q: any) => {
        setNewVersionQuote(q);
    };

    const [cancelModalQuote, setCancelModalQuote] = useState<any>(null);
    const [cancelReason, setCancelReason] = useState<string>('');
    const [cancelReasonText, setCancelReasonText] = useState<string>('');
    const [canceling, setCanceling] = useState(false);

    const handleCancelClick = (q: any) => {
        setCancelModalQuote(q);
        setCancelReason('');
        setCancelReasonText('');
    };

    const handleCancelSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cancelModalQuote) return;
        if (!cancelReason) {
            showToast('Selecione um motivo para o cancelamento.', 'error');
            return;
        }
        if (cancelReason === 'outro' && !cancelReasonText.trim()) {
            showToast('Descreva o motivo do cancelamento.', 'error');
            return;
        }

        setCanceling(true);
        try {
            const res = await fetch(`/api/quotes/${cancelModalQuote.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'cancelled',
                    cancel_reason: cancelReason,
                    cancel_reason_text: cancelReasonText
                }),
                credentials: 'include'
            });
            if (res.ok) {
                showToast('Orçamento cancelado.', 'success');
                fetchData(true);
                setCancelModalQuote(null);
            } else {
                const err = await res.json();
                showToast(err.error || 'Erro ao cancelar orçamento.', 'error');
            }
        } catch (error) {
            showToast('Erro de comunicação com o servidor.', 'error');
        } finally {
            setCanceling(false);
        }
    };

    const openPayModal = (q: any) => {
        // Cálculo do saldo real no momento da abertura
        const total = q.finalValue || q.totalValue || 0;
        const pago = q.fin_paid || 0;
        const credito = q.fin_credit || 0;

        let saldoReal = 0;
        if (q.fin_remaining !== null && q.fin_remaining !== undefined) {
            saldoReal = q.fin_remaining;
        } else {
            saldoReal = Math.max(0, total - pago - credito);
        }

        setPayModalQuote(q);
        setPayForm({
            valor_pago: String(saldoReal.toFixed(2)),
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

            {/* DASHBOARD */}
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

            {/* BARRA DE FILTROS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                <div className="flex flex-wrap gap-2">
                    {['all', 'draft', 'sent', 'approved', 'in_production', 'paid', 'expired', 'cancelled'].map(f => {
                        const count = f === 'all' ? quotes.length : quotes.filter(q => q.status === f).length;
                        return (
                            <button key={f} onClick={() => setStatusFilter(f)}
                                className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase transition-all flex items-center gap-2 ${statusFilter === f ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                {f === 'all' ? 'Todos' : STATUS_CONFIG[f]?.label || f}
                                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${statusFilter === f ? 'bg-white/20' : 'bg-slate-200 text-slate-400'}`}>{count}</span>
                            </button>
                        )
                    })}
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Buscar por cliente ou Nº orçamento..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
            </div>

            {/* LISTAGEM */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] font-black text-slate-500 tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Nº Orçamento</th>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4 text-right">Valor Total</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">
                                        Nenhum orçamento encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((q) => {
                                    const fallbackRestante = (q.finalValue || q.totalValue || 0) - (q.fin_paid || 0) - (q.fin_credit || 0);
                                    const valRestante = q.fin_remaining !== null && q.fin_remaining !== undefined ? q.fin_remaining : Math.max(0, fallbackRestante);
                                    const isTotalPaid = valRestante < 0.01 && ((q.fin_paid || 0) > 0 || (q.fin_credit || 0) > 0);
                                    const hasPaid = (q.fin_paid || 0) > 0 || (q.fin_credit || 0) > 0;
                                    const hasFinance = !!q.fin_id || hasPaid;
                                    const hasProd = !!q.prod_status;
                                    const finKey = isTotalPaid ? 'pago' : (hasPaid ? 'parcial' : 'pendente');

                                    const isDraft = q.status === 'draft';
                                    const stConf = STATUS_CONFIG[q.status] || STATUS_CONFIG['draft'];
                                    const fnConf = FIN_STATUS_CONFIG[finKey] || FIN_STATUS_CONFIG['pendente'];

                                    return (
                                        <tr key={q.id} className="hover:bg-slate-50/80 transition-all group">
                                            <td className="px-6 py-4 font-bold text-slate-900 group-hover:text-brand-primary transition-colors">
                                                {q.clientName}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-slate-500 text-xs">#{String(q.id).substring(0, 8).toUpperCase()}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-medium">
                                                {new Date(q.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-slate-900">
                                                {fmt(q.finalValue || q.totalValue)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${stConf.bg} ${stConf.color}`}>
                                                        {stConf.label}
                                                    </span>
                                                    {!isDraft && (
                                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${fnConf.bg} ${fnConf.color}`}>
                                                            {fnConf.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap items-center justify-center gap-1.5 w-[280px] sm:w-[340px] mx-auto">

                                                    {(!hasFinance && !hasProd && (q.status === 'draft' || q.status === 'sent')) ? (
                                                        <button onClick={() => navigate(`/orcamento?edit=${q.id}`)}
                                                            className="flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer whitespace-nowrap" title="Alterar">
                                                            <PenLine className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Alterar</span>
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => navigate(`/orcamento?view=${q.id}`)}
                                                            className="flex items-center gap-1 bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer whitespace-nowrap" title="Visualizar Orçamento">
                                                            <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Visualizar</span>
                                                        </button>
                                                    )}

                                                    {q.status !== 'cancelled' && q.status !== 'canceled' && (
                                                        <>
                                                            {(hasPaid || hasFinance || hasProd) && (
                                                                <button
                                                                    onClick={() => handleNewVersionClick(q)}
                                                                    className="flex items-center gap-1 bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer whitespace-nowrap"
                                                                    title="Nova Versão"
                                                                >
                                                                    <RefreshCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Nova Versão</span>
                                                                </button>
                                                            )}

                                                            {(q.status === 'draft' || q.status === 'sent') && (
                                                                <button
                                                                    onClick={() => handleApprove(q.id)}
                                                                    className="flex items-center gap-1 bg-brand-primary text-white hover:bg-blue-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer shadow-sm whitespace-nowrap"
                                                                >
                                                                    <CheckCircle2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Aprovar</span>
                                                                </button>
                                                            )}

                                                            {(q.status !== 'draft' && q.status !== 'sent') && (
                                                                <button
                                                                    onClick={() => handleReopen(q.id, false)}
                                                                    className="flex items-center gap-1 bg-slate-700 text-white hover:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer shadow-sm whitespace-nowrap"
                                                                >
                                                                    <RefreshCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reabrir</span>
                                                                </button>
                                                            )}

                                                            <button onClick={() => navigate(`/fabricacao/${q.id}`)}
                                                                className="flex items-center gap-1 bg-indigo-600 text-white hover:bg-indigo-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer shadow-sm whitespace-nowrap" title="Módulo Fabricação">
                                                                <Hammer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Fabricação</span>
                                                            </button>
                                                        </>
                                                    )}

                                                    <button onClick={() => window.open(`/api/quotes/${q.id}/client-report`, '_blank')}
                                                        className="flex items-center gap-1 bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer whitespace-nowrap" title="Orçamento Cliente (PDF)">
                                                        <FileDown className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cliente</span>
                                                    </button>

                                                    <button onClick={() => navigate(`/orcamento?printCompact=${q.id}`)}
                                                        className="flex items-center gap-1 bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer whitespace-nowrap" title="A4 Compacto (Obra)">
                                                        <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Obra</span>
                                                    </button>

                                                    {q.status !== 'cancelled' && q.status !== 'canceled' && !isTotalPaid && (
                                                        <button
                                                            onClick={() => openPayModal(q)}
                                                            className="flex items-center gap-1 bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer whitespace-nowrap"
                                                            title="Registrar Pagamento"
                                                        >
                                                            <DollarSign className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Pagar</span>
                                                        </button>
                                                    )}

                                                    {q.status !== 'cancelled' && q.status !== 'canceled' && !hasPaid && !hasFinance && !hasProd && (
                                                        <button
                                                            onClick={() => handleCancelClick(q)}
                                                            className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer whitespace-nowrap"
                                                            title="Cancelar Orçamento"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cancelar</span>
                                                        </button>
                                                    )}
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

            {/* MODAL DE CANCELAMENTO */}
            <AnimatePresence>
                {cancelModalQuote && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative border border-slate-100">
                            <div className="absolute top-0 right-0 p-6">
                                <button onClick={() => setCancelModalQuote(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-all cursor-pointer">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                                    <XCircle className="w-7 h-7 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">Cancelar Orçamento</h3>
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
                                        Ref: #{String(cancelModalQuote.id).substring(0, 8).toUpperCase()}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleCancelSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-3 tracking-wider">Motivo do Cancelamento</label>
                                    <div className="space-y-2">
                                        {[
                                            { id: 'cliente_desistiu', label: 'Cliente desistiu' },
                                            { id: 'perdeu_concorrencia', label: 'Perdeu para concorrência' },
                                            { id: 'preco_alto', label: 'Preço alto' },
                                            { id: 'servico_adiado', label: 'Serviço adiado' },
                                            { id: 'outro', label: 'Outro' }
                                        ].map(opt => (
                                            <label key={opt.id} className="flex items-center p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                                <input type="radio" name="cancel_reason" value={opt.id} checked={cancelReason === opt.id} onChange={() => setCancelReason(opt.id)} className="w-4 h-4 text-red-500 border-slate-300 focus:ring-red-500" />
                                                <span className="ml-3 text-sm font-medium text-slate-700">{opt.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {cancelReason === 'outro' && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-2 tracking-wider mt-4">Descreva o motivo (obrigatório)</label>
                                        <textarea required value={cancelReasonText} onChange={e => setCancelReasonText(e.target.value)} rows={3}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
                                            placeholder="Detalhes..." />
                                    </motion.div>
                                )}

                                <div className="pt-4">
                                    <button type="submit" disabled={canceling} className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl shadow-red-500/20 disabled:opacity-50 transition-all cursor-pointer">
                                        {canceling ? 'Cancelando...' : 'Confirmar Cancelamento'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL PAGAMENTO */}
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
                                    <span className="text-2xl font-black text-brand-primary tracking-tight">{fmt(payModalQuote.fin_remaining)}</span>
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

                {/* MODAL NOVA VERSÃO */}
                {newVersionQuote && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative border border-slate-100">

                            <div className="absolute top-0 right-0 p-6">
                                <button type="button" onClick={() => setNewVersionQuote(null)}
                                    className="text-slate-400 hover:text-slate-600 bg-slate-50 rounded-full w-10 h-10 flex items-center justify-center font-bold pb-1 text-xl cursor-pointer hover:bg-slate-100 transition-all">
                                    ×
                                </button>
                            </div>

                            <div className="mb-6">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                    <RefreshCcw className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">Nova Versão</h3>
                                <p className="text-slate-500 text-sm font-medium">Pedido #{String(newVersionQuote.id).substring(0, 8)} • {newVersionQuote.clientName}</p>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8 space-y-3">
                                {newVersionQuote.fin_paid > 0 ? (
                                    <>
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 mb-1">Pagamento Vinculado Detectado</p>
                                                <p className="text-xs text-slate-600 leading-relaxed">
                                                    Existe um pagamento de <span className="font-black text-emerald-600">{fmt(newVersionQuote.fin_paid)}</span> neste orçamento.
                                                </p>
                                            </div>
                                        </div>
                                        <ul className="text-xs text-slate-500 font-medium space-y-2 mt-2 ml-8 list-disc bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <li>O orçamento atual será <span className="text-rose-600 font-bold">cancelado</span>.</li>
                                            <li>Um novo orçamento será criado em estado de <span className="font-bold">rascunho</span>.</li>
                                            <li>Os pagamentos financeiros serão convertidos em <span className="text-brand-primary font-black">Crédito</span>.</li>
                                        </ul>
                                    </>
                                ) : (
                                    <div className="flex items-start gap-3">
                                        <RefreshCcw className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                        <p className="text-sm text-slate-600 font-medium">
                                            O orçamento atual será cancelado e uma cópia exata será criada em estado de <span className="font-bold text-slate-900">Rascunho</span>, permitindo novas edições.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setNewVersionQuote(null)} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all cursor-pointer">
                                    Voltar
                                </button>
                                <button onClick={confirmNewVersion} className="flex-1 bg-blue-600 text-white py-3.5 rounded-2xl font-black text-xs uppercase shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all cursor-pointer">
                                    Confirmar Versão
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
