import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Factory, ArrowLeft, RefreshCw, CheckCircle, Package, Save, RotateCcw } from 'lucide-react';

export default function Fabricacao() {
    const { estimateId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<any[]>([]);
    const [clientName, setClientName] = useState('');
    const [finishing, setFinishing] = useState(false);

    useEffect(() => {
        fetchItems();
    }, [estimateId]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/fabricacao/${estimateId}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);
                setClientName(data.clientName || 'Cliente');
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao carregar fabricação');
            }
        } catch (e) {
            console.error('Erro ao carregar itens:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (item: any) => {
        try {
            const res = await fetch(`/api/fabricacao/item/${item.id}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ concluido: !item.concluido }),
                credentials: 'include'
            });
            if (res.ok) {
                setItems(items.map(i => i.id === item.id ? { ...i, concluido: !item.concluido } : i));
            }
        } catch (e) {
            console.error('Erro ao alternar status:', e);
        }
    };

    const handleFinish = async () => {
        setFinishing(true);
        try {
            const res = await fetch(`/api/fabricacao/order/${estimateId}/finish`, {
                method: 'POST',
                credentials: 'include'
            });
            if (res.ok) {
                alert('Produção finalizada com sucesso!');
                navigate(-1);
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao finalizar');
            }
        } catch (e) {
            console.error('Erro ao finalizar:', e);
        } finally {
            setFinishing(false);
        }
    };

    const completedCount = items.filter(i => i.concluido).length;
    const totalCount = items.length;
    const allDone = totalCount > 0 && completedCount === totalCount;

    // Group items by room (comodo)
    const groupedItems: Record<string, any[]> = {};
    items.forEach(item => {
        const room = item.comodo || 'Geral';
        if (!groupedItems[room]) groupedItems[room] = [];
        groupedItems[room].push(item);
    });

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-slate-900 text-white pt-24 pb-12 px-6">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors cursor-pointer">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black">Módulo de Fabricação</h1>
                            <p className="text-slate-400">Orçamento #{estimateId?.substring(0, 8).toUpperCase()} • {clientName}</p>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto -mt-6 px-6">
                {/* Stats Bar */}
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/60 border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                            <Factory className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Status da Produção</p>
                            <p className="text-xl font-black text-slate-900">
                                {completedCount} de {totalCount} concluídas
                            </p>
                        </div>
                    </div>

                    {allDone ? (
                        <button onClick={handleFinish} disabled={finishing}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg shadow-green-600/20 active:scale-[0.98] cursor-pointer">
                            <CheckCircle2 className="w-5 h-5" /> {finishing ? 'Processando...' : 'Finalizar Produção'}
                        </button>
                    ) : (
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Progresso</p>
                                <div className="w-32 h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(completedCount / totalCount) * 100 || 0}%` }} />
                                </div>
                            </div>
                            <button onClick={() => navigate(-1)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer border border-slate-200 shadow-sm">
                                <Save className="w-4 h-4" /> Salvar Sair
                            </button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-slate-400 font-bold">Carregando itens para dobra...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="bg-white rounded-3xl p-20 mt-6 text-center border border-dashed border-slate-300">
                        <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold">Nenhuma dobra encontrada neste orçamento.</p>
                        <button onClick={() => navigate(-1)} className="mt-4 text-blue-500 font-bold hover:underline">Voltar</button>
                    </div>
                ) : (
                    <div className="mt-8 space-y-8">
                        {Object.entries(groupedItems).map(([room, roomItems]) => (
                            <div key={room} className="space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-4">{room}</h3>
                                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                                    <div className="divide-y divide-slate-50">
                                        {roomItems.map((item) => (
                                            <div key={item.id}
                                                onClick={() => handleToggle(item)}
                                                className={`flex items-center gap-4 p-5 transition-all cursor-pointer hover:bg-slate-50 group`}>
                                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.concluido ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 group-hover:border-blue-300'}`}>
                                                    {item.concluido && <CheckCircle className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`font-bold transition-all ${item.concluido ? 'line-through opacity-40 text-slate-500' : 'text-slate-900 group-hover:text-blue-900'}`}>
                                                        {item.metragem.toFixed(2).replace('.', ',')}m — {item.description.includes('[BEND]') ? 'Dobra Customizada' : item.description}
                                                    </p>
                                                    {item.concluido_em && (
                                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                                            Concluído em: {new Date(item.concluido_em).toLocaleString('pt-BR')}
                                                        </p>
                                                    )}
                                                </div>
                                                {item.concluido && (
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                                                            <RotateCcw className="w-3 h-3" /> Desfazer
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
