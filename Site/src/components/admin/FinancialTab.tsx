import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, AlertCircle, CalendarClock, Clock, PieChart } from 'lucide-react';

interface Props {
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function FinancialTab({ showToast }: Props) {
    const [receivables, setReceivables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReceivables = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/financial/receivables', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();

                // Tratar "Atrasado" visualmente baseado na data caso não esteja pago
                const hojeStr = new Date().toISOString().split('T')[0];
                const processed = data.map((r: any) => {
                    let st = r.status;
                    if (r.data_vencimento && r.data_vencimento < hojeStr && st !== 'pago') {
                        st = 'atrasado';
                    }
                    return { ...r, _statusCalc: st };
                });

                setReceivables(processed);
            } else {
                showToast('Erro ao carregar dados financeiros', 'error');
            }
        } catch {
            showToast('Erro de conexão', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReceivables(); }, []);

    const fmt = (v: number) => `R$ ${(Number(v) || 0).toFixed(2)}`;

    // === 2. INDICADORES ======
    const totalAReceber = receivables.filter(r => ['pendente', 'parcial'].includes(r._statusCalc)).reduce((acc, r) => acc + Number(r.valor_restante), 0);
    const totalAtraso = receivables.filter(r => r._statusCalc === 'atrasado').reduce((acc, r) => acc + Number(r.valor_restante), 0);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const recebidoNoMes = receivables.reduce((acc, r) => {
        const u = new Date(r.updated_at);
        if (r.valor_pago > 0 && u.getMonth() === currentMonth && u.getFullYear() === currentYear) {
            return acc + Number(r.valor_pago);
        }
        return acc;
    }, 0);

    const faturamentoMes = receivables.reduce((acc, r) => {
        const c = new Date(r.created_at);
        if (c.getMonth() === currentMonth && c.getFullYear() === currentYear) {
            return acc + Number(r.valor_total);
        }
        return acc;
    }, 0);

    // === 3. GRÁFICO ======
    const getLast6Months = () => {
        const labels = [];
        const faturamento = [];
        const recebimento = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase());

            const m = d.getMonth();
            const y = d.getFullYear();

            const sumFat = receivables.filter(r => {
                const c = new Date(r.created_at);
                return c.getMonth() === m && c.getFullYear() === y;
            }).reduce((acc, r) => acc + Number(r.valor_total), 0);

            const sumRec = receivables.filter(r => {
                const u = new Date(r.updated_at);
                return u.getMonth() === m && u.getFullYear() === y;
            }).reduce((acc, r) => acc + Number(r.valor_pago), 0);

            faturamento.push(sumFat);
            recebimento.push(sumRec);
        }
        return { labels, faturamento, recebimento };
    };

    const chartData = getLast6Months();
    const maxVal = Math.max(...chartData.faturamento, ...chartData.recebimento, 1);

    // === 4. PRÓXIMOS VENCIMENTOS ======
    const proximosVencimentos = receivables
        .filter(r => r._statusCalc !== 'pago' && r.data_vencimento)
        .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())
        .slice(0, 5);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold flex items-center gap-2"><PieChart className="w-6 h-6 text-brand-primary" /> Dashboard Financeiro</h2>

            {loading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : (
                <>
                    {/* INDICADORES CARDS - UNICA LINHA ROLAVEL */}
                    <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                        <div className="min-w-[200px] flex-1 bg-white border text-left border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">A Receber</p>
                                <p className="text-xl font-black text-slate-800">{fmt(totalAReceber)}</p>
                            </div>
                            <div className="w-10 h-10 bg-blue-100/50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0"><DollarSign className="w-5 h-5" /></div>
                        </div>
                        <div className="min-w-[200px] flex-1 bg-white border text-left border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Em Atraso</p>
                                <p className="text-xl font-black text-red-600">{fmt(totalAtraso)}</p>
                            </div>
                            <div className="w-10 h-10 bg-red-100/50 text-red-600 rounded-2xl flex items-center justify-center shrink-0"><AlertCircle className="w-5 h-5" /></div>
                        </div>
                        <div className="min-w-[200px] flex-1 bg-white border text-left border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Recebido Mes</p>
                                <p className="text-xl font-black text-emerald-600">{fmt(recebidoNoMes)}</p>
                            </div>
                            <div className="w-10 h-10 bg-emerald-100/50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0"><TrendingUp className="w-5 h-5" /></div>
                        </div>
                        <div className="min-w-[200px] flex-1 bg-white border text-left border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Faturamento Mes</p>
                                <p className="text-xl font-black text-indigo-600">{fmt(faturamentoMes)}</p>
                            </div>
                            <div className="w-10 h-10 bg-indigo-100/50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0"><DollarSign className="w-5 h-5" /></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        {/* GRÁFICO BARRAS */}
                        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between" style={{ minHeight: '350px' }}>
                            <div>
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">📊 Faturamento vs Recebimentos (Últimos 6 meses)</h3>
                                <div className="h-48 flex items-end gap-2 sm:gap-6 justify-between relative mt-8">
                                    {chartData.labels.map((lbl, i) => {
                                        const fatH = (chartData.faturamento[i] / maxVal) * 100;
                                        const recH = (chartData.recebimento[i] / maxVal) * 100;

                                        return (
                                            <div key={lbl} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                                {/* Tooltips */}
                                                <div className="opacity-0 group-hover:opacity-100 absolute -top-12 bg-slate-800 text-white text-[10px] p-2 rounded-lg pointer-events-none transition-opacity whitespace-nowrap z-10 flex flex-col shadow-xl">
                                                    <span className="text-indigo-300">Fat: {fmt(chartData.faturamento[i])}</span>
                                                    <span className="text-emerald-400">Rec: {fmt(chartData.recebimento[i])}</span>
                                                </div>

                                                <div className="w-full flex justify-center items-end gap-[1px] h-full overflow-hidden rounded-t-lg">
                                                    <div className="w-1/2 max-w-[32px] bg-indigo-200 group-hover:bg-indigo-400 transition-colors" style={{ height: `${Math.max(fatH, 2)}%` }}></div>
                                                    <div className="w-1/2 max-w-[32px] bg-emerald-300 group-hover:bg-emerald-400 transition-colors" style={{ height: `${Math.max(recH, 2)}%` }}></div>
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-400 mt-3">{lbl}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            <div className="flex justify-center gap-6 mt-6 border-t border-slate-100 pt-4">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-200 rounded-sm"></div><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Faturamento</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-300 rounded-sm"></div><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Recebimento</span></div>
                            </div>
                        </div>

                        {/* LISTA VENCIMENTOS */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" style={{ minHeight: '350px' }}>
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-wider"><CalendarClock className="w-5 h-5 text-amber-500" /> Próximos Vencimentos</h3>
                            <div className="space-y-3">
                                {proximosVencimentos.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-10 italic">Nenhum vencimento pendente.</p>
                                ) : proximosVencimentos.map(r => {
                                    const d = new Date(r.data_vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                                    const isLate = r._statusCalc === 'atrasado';
                                    return (
                                        <div key={r.id} className={`flex items-center justify-between p-3.5 border-l-4 rounded-xl hover:bg-slate-50 transition-colors cursor-default ${isLate ? 'border-red-500 bg-red-50/30' : 'border-amber-400 bg-white shadow-sm border border-slate-100'}`}>
                                            <div className="min-w-0 pr-2">
                                                <p className="font-bold text-[13px] text-slate-800 truncate">{r.client?.name || 'Cliente'}</p>
                                                <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" /> {d}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className={`font-black text-[13px] ${isLate ? 'text-red-600' : 'text-slate-800'}`}>{fmt(r.valor_restante)}</p>
                                                <p className={`text-[9px] font-bold uppercase mt-0.5 ${isLate ? 'text-red-500' : 'text-amber-500'}`}>{isLate ? 'Atrasado' : 'A Vencer'}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
