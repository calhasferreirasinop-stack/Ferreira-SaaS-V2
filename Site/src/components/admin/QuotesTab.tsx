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
            alert('Este orçamento já possui pagamentos e não pode ser reaberto diretamente. Use "Nova Versão" para gerar um crédito.');
            return;
        }
        if (!confirm('Deseja reabrir este orçamento para edição? O registro financeiro pendente será removido.')) return;
        const res = await fetch(`/api/quotes/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending' }),
            credentials: 'include'
        });
        if (res.ok) { showToast('Orçamento reaberto!', 'success'); fetchData(true); }
    };

    const handleNewVersion = async (q: any) => {
        const msg = `Deseja criar uma nova versão?\n\nO orçamento atual será cancelado e o valor de ${fmt(q.fin_paid)} já pago será transferido como CRÉDITO para a nova versão.`;
        if (!confirm(msg)) return;

        const res = await fetch(`/api/quotes/${q.id}/new-version`, { method: 'POST', credentials: 'include' });
        if (res.ok) {
            showToast('Nova versão criada com sucesso! O crédito foi aplicado.', 'success');
            fetchData(true);
        } else {
            const d = await res.json();
            showToast(d.error || 'Erro ao criar versão', 'error');
        }
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
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 font-sans tracking-tight">
            {/* Top Summary Cards (Smaller) */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {summaryCards.map((card, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveFilter(card.filter)}
                        className={`p-4 rounded-2xl flex flex-col items-center justify-center transition-all border-2 cursor-pointer shadow-sm
                        ${card.color} ${activeFilter === card.filter ? 'border-current' : 'border-transparent hover:scale-[1.03]'}`}
                    >
                        <span className="text-2xl font-black mb-0.5">{card.count}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-80 text-center leading-none">{card.label}</span>
                    </button>
                ))}
            </div>

            {/* Header & Search (More compact) */}
            <div className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        placeholder="Pesquisar..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-11 pr-6 py-2.5 bg-slate-50 border-none rounded-xl text-sm w-full shadow-inner focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => navigate('/orcamento')} className="bg-brand-primary text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md shadow-brand-primary/10 cursor-pointer flex-1 md:flex-none">
                        <Plus className="w-4 h-4" /> Novo Pedido
                    </button>
                    {activeFilter !== 'all' && (
                        <button onClick={() => setActiveFilter('all')} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:opacity-90 transition-all cursor-pointer shadow-sm">
                            Todos
                        </button>
                    )}
                </div>
            </div>

            {/* List Header (Aligns with Card content) */}
            <div className="px-6 grid grid-cols-12 text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">
                <div className="col-span-5">Cliente / Data</div>
                <div className="col-span-2 text-center">Valor Total</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-3 text-right">Ações Rápidas</div>
            </div>

            {/* Quotes List (Compact Row Style) */}
            <div className="space-y-2">
                {filtered.map(q => {
                    const st = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
                    const hasPaid = (q.fin_paid || 0) > 0;
                    const finStKey = q.fin_remaining === 0 ? 'pago' : (hasPaid ? 'parcial' : 'pendente');
                    const finSt = FIN_STATUS_CONFIG[finStKey];
                    const isApproved = q.status === 'approved' || q.status === 'paid' || q.status === 'partial' || q.status === 'in_production';

                    return (
                        <div key={q.id} className="bg-white rounded-2xl border border-slate-100 p-4 md:px-6 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group">
                            {/* Accent Line */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${st.color}`} />

                            <div className="grid grid-cols-12 items-center gap-4">
                                {/* Col 1: Client & Meta */}
                                <div className="col-span-12 md:col-span-5 flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${st.lightColor} flex-shrink-0`}>
                                        <st.icon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex items-center gap-3">
                                        <div className="truncate">
                                            <h4 className="text-sm font-black text-slate-900 truncate tracking-tight">{q.clientName || 'Cliente'}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 font-mono">
                                                {new Date(q.createdAt).toLocaleDateString('pt-BR')} • #{q.id.substring(0, 8).toUpperCase()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => window.open(`/api/reports/client/${q.id}`, '_blank')}
                                            className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all cursor-pointer"
                                            title="Baixar PDF"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Col 2: Price */}
                                <div className="col-span-4 md:col-span-2 text-center">
                                    <p className="text-sm font-black text-slate-800 tracking-tight">{fmt(q.finalValue || q.totalValue || 0)}</p>
                                    {hasPaid && (
                                        <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Pago {fmt(q.fin_paid)}</p>
                                    )}
                                </div>

                                {/* Col 3: Statuses */}
                                <div className="col-span-4 md:col-span-2 flex flex-col items-center gap-1">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight shadow-sm whitespace-nowrap ${st.lightColor}`}>
                                        {st.label}
                                    </span>
                                    {isApproved && (
                                        <div className="flex items-center gap-0.5 scale-75 origin-center">
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${finSt.color}`}>
                                                {finSt.label}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Col 4: Buttons (Always Small/Compact) */}
                                <div className="col-span-4 md:col-span-3 flex items-center justify-end gap-1">
                                    {/* Action 1: Approve or Reopen/NewVersion */}
                                    {(q.status === 'draft' || q.status === 'sent') ? (
                                        <button
                                            onClick={() => handleApprove(q.id)}
                                            className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                        >
                                            <CheckCircle2 className="w-3 h-3" /> Aprovar
                                        </button>
                                    ) : isApproved && (
                                        hasPaid ? (
                                            <button
                                                onClick={() => handleNewVersion(q)}
                                                className="px-3 py-2 bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase hover:bg-blue-600 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                            >
                                                <RefreshCcw className="w-3 h-3" /> Nova Versão
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleReopen(q.id, false)}
                                                className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                            >
                                                <RefreshCcw className="w-3 h-3" /> Reabrir
                                            </button>
                                        )
                                    )}

                                    {/* Action 2: Pagar (Laranja) */}
                                    {!q.fin_remaining || q.fin_remaining > 0 ? (
                                        <button
                                            onClick={() => openPayModal(q)}
                                            className="px-3 py-2 bg-brand-primary text-white rounded-lg text-[9px] font-black uppercase hover:opacity-90 transition-all cursor-pointer flex items-center gap-1 shadow-sm shadow-brand-primary/10"
                                        >
                                            <DollarSign className="w-3 h-3" /> Pagar
                                        </button>
                                    ) : null}

                                    {/* Action 3: Cancelar / Utilities */}
                                    <button
                                        onClick={() => handleCancel(q.id)}
                                        className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                                        title="Cancelar"
                                    >
                                        <XCircle className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                        onClick={() => navigate(`/orcamento?view=${q.id}`)}
                                        className="p-2 bg-slate-900 text-white rounded-lg hover:opacity-80 transition-all cursor-pointer"
                                        title="Visualizar"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty State */}
            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-100 shadow-sm">
                    <Package className="w-10 h-10 text-slate-100 mb-4" />
                    <p className="text-slate-300 font-bold text-[10px] uppercase tracking-widest">Nenhum registro</p>
                </div>
            )}

            {/* Payment Modal */}
            <AnimatePresence>
                {payModalQuote && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative border border-slate-100">

                            <div className="absolute top-0 right-0 p-5">
                                <button type="button" onClick={() => setPayModalQuote(null)}
                                    className="text-slate-400 hover:text-slate-600 bg-slate-50 rounded-xl w-8 h-8 flex items-center justify-center font-bold text-lg cursor-pointer transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <h3 className="text-xl font-black text-slate-900 mb-1">Registrar Pagamento</h3>
                            <p className="text-slate-400 text-[10px] mb-6 font-bold uppercase tracking-widest">ORC-#{String(payModalQuote.id).substring(0, 8)}</p>

                            <form onSubmit={handlePaySubmit} className="space-y-4">
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex justify-between items-center">
                                    <span className="text-slate-400 font-black uppercase text-[9px] tracking-widest">Restante</span>
                                    <span className="text-xl font-black text-brand-primary">{fmt(payModalQuote.fin_remaining ?? payModalQuote.finalValue ?? payModalQuote.totalValue)}</span>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Valor do Pagamento</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black">R$</span>
                                        <input type="number" step="0.01" min="0.01" required autoFocus
                                            value={payForm.valor_pago} onChange={e => setPayForm({ ...payForm, valor_pago: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 text-lg font-black text-slate-900 outline-none focus:border-brand-primary" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Data</label>
                                        <input type="date" required value={payForm.data_pagamento} onChange={e => setPayForm({ ...payForm, data_pagamento: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Forma</label>
                                        <select value={payForm.forma_pagamento} onChange={e => setPayForm({ ...payForm, forma_pagamento: e.target.value })} required
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer">
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
                                        className="w-full bg-brand-primary text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-primary/20 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer">
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
