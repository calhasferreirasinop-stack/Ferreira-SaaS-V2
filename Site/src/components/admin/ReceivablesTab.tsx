import React, { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, CheckCircle2, Clock, Search, ExternalLink, Calendar, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function ReceivablesTab({ showToast }: Props) {
    const [receivables, setReceivables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, pendente, parcial, pago, atrasado
    const [search, setSearch] = useState('');

    // Payment Modal
    const [payModalAccount, setPayModalAccount] = useState<any>(null);
    const [payForm, setPayForm] = useState({ valor_pago: '', data_pagamento: new Date().toISOString().split('T')[0], forma_pagamento: '', observacao: '' });
    const [paying, setPaying] = useState(false);

    useEffect(() => {
        fetchReceivables();
    }, []);

    const fetchReceivables = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/financial/receivables', { credentials: 'include' });
            if (res.ok) {
                setReceivables(await res.json());
            } else {
                showToast('Erro ao carregar contas', 'error');
            }
        } catch {
            showToast('Erro de conexão', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payModalAccount) return;
        setPaying(true);
        try {
            const res = await fetch(`/api/financial/receivables/${payModalAccount.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payForm),
                credentials: 'include'
            });
            if (res.ok) {
                showToast('Pagamento registrado!', 'success');
                setPayModalAccount(null);
                fetchReceivables();
            } else {
                const data = await res.json();
                showToast(data.error || 'Erro ao registrar pagamento', 'error');
            }
        } catch {
            showToast('Erro de conexão', 'error');
        } finally {
            setPaying(false);
        }
    };

    const fmt = (v: number) => `R$ ${(Number(v) || 0).toFixed(2)}`;

    // Cálculos do Dashboard
    const totalReceber = receivables.filter(r => r.status === 'pendente' || r.status === 'parcial' || r.status === 'atrasado').reduce((acc, r) => acc + Number(r.valor_restante), 0);
    const totalRecebido = receivables.reduce((acc, r) => acc + Number(r.valor_pago), 0);
    const totalAtraso = receivables.filter(r => r.status === 'atrasado').reduce((acc, r) => acc + Number(r.valor_restante), 0);

    // Filtro
    const filtered = receivables.filter(r => {
        const term = search.toLowerCase();
        const clName = r.client?.name?.toLowerCase() || '';
        const matchesSearch = term === '' || clName.includes(term) || String(r.estimate?.id).includes(term);
        const matchesFilter = filter === 'all' || r.status === filter;
        return matchesSearch && matchesFilter;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pendente': return <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold uppercase">Pendente</span>;
            case 'parcial': return <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase">Parcial</span>;
            case 'pago': return <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold uppercase">Pago</span>;
            case 'atrasado': return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold uppercase">Atrasado</span>;
            default: return null;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="w-6 h-6 text-brand-primary" /> Contas a Receber</h2>
            </div>

            {/* DASHBOARD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">A Receber</p>
                        <p className="text-2xl font-black text-slate-900">{fmt(totalReceber)}</p>
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
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Em Atraso</p>
                        <p className="text-2xl font-black text-red-600">{fmt(totalAtraso)}</p>
                    </div>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                <div className="flex flex-wrap gap-2">
                    {['all', 'pendente', 'parcial', 'pago', 'atrasado'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold uppercase transition-all ${filter === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {f === 'all' ? 'Todos' : f}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Buscar por cliente ou ID..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
            </div>

            {/* LISTAGEM - Card View (Mobile) */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="text-center py-8"><div className="w-6 h-6 border-4 border-brand-primary border-t-transparent flex rounded-full animate-spin mx-auto" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium">Nenhuma conta encontrada.</div>
                ) : (
                    filtered.map(r => (
                        <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-black text-slate-900 leading-tight">{r.client?.name || 'Cliente Removido'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">#{String(r.estimate?.id).substring(0, 8)}</p>
                                </div>
                                {getStatusBadge(r.status)}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-50 p-2 rounded-lg">
                                    <p className="text-slate-400 uppercase font-black text-[9px] mb-0.5">Total</p>
                                    <p className="font-bold text-slate-700">{fmt(r.valor_total)}</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg">
                                    <p className="text-slate-400 uppercase font-black text-[9px] mb-0.5">Pago</p>
                                    <p className="font-bold text-green-600">{fmt(r.valor_pago)}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                <div>
                                    <p className="text-slate-400 uppercase font-black text-[9px] mb-0.5">Restante</p>
                                    <p className="text-lg font-black text-brand-primary">{fmt(r.valor_restante)}</p>
                                    <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-1">
                                        <Calendar className="w-3 h-3 text-slate-300" /> Venc: {r.data_vencimento ? new Date(r.data_vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setPayModalAccount(r);
                                        setPayForm({ ...payForm, valor_pago: String(r.valor_restante) });
                                    }}
                                    disabled={r.status === 'pago'}
                                    className="bg-brand-primary text-white px-6 py-3 border-none rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                                >
                                    Pagar
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* LISTAGEM - Table View (Desktop) */}
            <div className="hidden md:block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase">
                            <tr>
                                <th className="px-6 py-4">Cliente / ID Orçamento</th>
                                <th className="px-6 py-4">Valor Total</th>
                                <th className="px-6 py-4">Valor Pago</th>
                                <th className="px-6 py-4">Restante</th>
                                <th className="px-6 py-4">Vencimento</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-8"><div className="w-6 h-6 border-4 border-brand-primary border-t-transparent flex rounded-full animate-spin mx-auto" /></td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-12 text-slate-400 font-medium">Nenhuma conta encontrada.</td></tr>
                            ) : (
                                filtered.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-900">{r.client?.name || 'Cliente Removido'}</p>
                                            <p className="text-xs text-slate-400 font-mono">#{String(r.estimate?.id).substring(0, 8)}</p>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">{fmt(r.valor_total)}</td>
                                        <td className="px-6 py-4 font-bold text-green-600">{fmt(r.valor_pago)}</td>
                                        <td className="px-6 py-4 font-black text-brand-primary">{fmt(r.valor_restante)}</td>
                                        <td className="px-6 py-4">
                                            {r.data_vencimento ? new Date(r.data_vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(r.status)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => {
                                                    setPayModalAccount(r);
                                                    setPayForm({ ...payForm, valor_pago: String(r.valor_restante) });
                                                }}
                                                disabled={r.status === 'pago'}
                                                className="bg-brand-primary text-white p-2 border-none rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                                title="Registrar Pagamento"
                                            >
                                                Pagar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL PAGAMENTO */}
            <AnimatePresence>
                {payModalAccount && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">

                            <div className="absolute top-0 right-0 p-4">
                                <button type="button" onClick={() => setPayModalAccount(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center font-bold pb-1 text-xl cursor-pointer hover:bg-slate-200 transition-colors">x</button>
                            </div>

                            <h3 className="text-xl font-black text-slate-900 mb-1">Registrar Pagamento</h3>
                            <p className="text-slate-500 text-sm mb-6">Orçamento #{String(payModalAccount.estimate_id).substring(0, 8)} • Recebendo de {payModalAccount.client?.name}</p>

                            <form onSubmit={handlePay} className="space-y-4">
                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center mb-6">
                                    <span className="text-slate-600 font-bold uppercase text-xs">Valor Pendente</span>
                                    <span className="text-xl font-black text-brand-primary">{fmt(payModalAccount.valor_restante)}</span>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Valor do Pagamento</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                        <input type="number" step="0.01" min="0.01" max={payModalAccount.valor_restante} required autoFocus
                                            value={payForm.valor_pago} onChange={e => setPayForm({ ...payForm, valor_pago: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-lg font-bold outline-none focus:border-brand-primary" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Data</label>
                                        <input type="date" required value={payForm.data_pagamento} onChange={e => setPayForm({ ...payForm, data_pagamento: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-primary" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Forma</label>
                                        <select value={payForm.forma_pagamento} onChange={e => setPayForm({ ...payForm, forma_pagamento: e.target.value })} required
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-brand-primary">
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
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Observações (Opcional)</label>
                                    <textarea rows={2} value={payForm.observacao} onChange={e => setPayForm({ ...payForm, observacao: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-primary resize-none" />
                                </div>

                                <div className="pt-4">
                                    <button type="submit" disabled={paying}
                                        className="w-full bg-brand-primary text-white py-3.5 rounded-xl font-bold text-sm shadow-lg border-2 border-transparent disabled:opacity-50 hover:bg-brand-dark transition-all">
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
