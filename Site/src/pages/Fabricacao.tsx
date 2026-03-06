import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Factory, ArrowLeft, RefreshCw, CheckCircle, Package, Save, RotateCcw, Plus, Trash2, X, Layers, Zap, Ruler } from 'lucide-react';
import BendCanvas, { Risk } from '../components/BendCanvas';

export default function Fabricacao() {
    // Estilos para impressão A4
    const printStyles = `
        @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            .print-card { 
                break-inside: avoid !important; 
                page-break-inside: avoid !important;
                border: 1px solid #ddd !important;
                box-shadow: none !important;
            }
            .grid { 
                display: grid !important; 
                grid-template-columns: repeat(2, 1fr) !important; 
                gap: 15px !important;
            }
            main { margin-top: 0 !important; padding: 0 !important; max-width: 100% !important; }
            @page { margin: 1cm; }
        }
    `;

    const { estimateId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<any[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [clientName, setClientName] = useState('');
    const [finishing, setFinishing] = useState(false);
    const [estimate, setEstimate] = useState<any>(null);

    // --- SOBRAS ---
    const [remnants, setRemnants] = useState<any[]>([]);
    const [showRemnantModal, setShowRemnantModal] = useState(false);
    const [newWidth, setNewWidth] = useState('');
    const [newLength, setNewLength] = useState('');
    const [addingRemnant, setAddingRemnant] = useState(false);

    // --- OTIMIZAÇÃO ---
    const [optimizedPlan, setOptimizedPlan] = useState<any[] | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);

    useEffect(() => {
        fetchItems();
        fetchRemnants();
    }, [estimateId]);

    const fetchRemnants = async () => {
        try {
            const res = await fetch('/api/fabricacao/remnants', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setRemnants(data || []);
                return data || [];
            }
        } catch (e) {
            console.error('Erro ao carregar sobras:', e);
        }
        return [];
    };

    const handleAddRemnant = async () => {
        if (!newWidth || !newLength) return;
        setAddingRemnant(true);
        try {
            const res = await fetch('/api/fabricacao/remnants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ width_cm: newWidth, length_m: newLength }),
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setRemnants([data, ...remnants]);
                setNewWidth('');
                setNewLength('');
            }
        } catch (e) {
            console.error('Erro ao adicionar sobra:', e);
        } finally {
            setAddingRemnant(false);
        }
    };

    const handleDeleteRemnant = async (id: string) => {
        try {
            const res = await fetch(`/api/fabricacao/remnants/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                setRemnants(remnants.filter(r => r.id !== id));
            }
        } catch (e) {
            console.error('Erro ao excluir sobra:', e);
        }
    };

    const runOptimization = async () => {
        setIsOptimizing(true);
        // Recarregar sobras antes para garantir que as novas disparadas pelo usuário estejam lá
        const freshRemnants = await fetchRemnants();

        try {
            const estimateItems = estimate?.estimate_items || [];
            const planPiecesIds = new Set<string>();
            const allPieces: any[] = [];

            const processedBends = estimateItems
                .filter((ei: any) => ei.description.includes('[BEND]'))
                .map((ei: any, bendIndex: number) => {
                    let bendData: any = {};
                    try {
                        bendData = JSON.parse(ei.description.replace('[BEND]', ''));
                    } catch (e) { return null; }

                    const lengths = Array.isArray(bendData.lengths) ? bendData.lengths.filter((l: any) => parseFloat(l) > 0) : [];

                    return {
                        id: bendData.id || `bend-${bendIndex}`,
                        room: ei.room || 'Geral',
                        description: bendData.productName || 'Dobra',
                        width: bendData.roundedWidthCm || 0,
                        risks: bendData.risks || [],
                        lengths: lengths.map((l: any) => parseFloat(l)),
                        originalItem: ei
                    };
                }).filter(Boolean);

            processedBends.forEach(bend => {
                bend.lengths.forEach((len: number, pIdx: number) => {
                    const realItem = items.find(i =>
                        !planPiecesIds.has(i.id) &&
                        i.metragem === len &&
                        (i.description.includes(bend.id) || i.description.includes(bend.description))
                    );

                    if (realItem) planPiecesIds.add(realItem.id);

                    allPieces.push({
                        bendId: bend.id,
                        pieceIdx: pIdx,
                        length: len,
                        width: bend.width,
                        description: bend.description,
                        room: bend.room,
                        productionItem: realItem,
                        productionItemId: realItem?.id,
                        concluido: realItem?.concluido || false
                    });
                });
            });

            allPieces.sort((a, b) => b.length - a.length);

            let availableRemnants = freshRemnants.map((r: any) => ({ ...r, remainingLength: parseFloat(r.length_m) }));
            const pieceToSeq: Record<string, any> = {};
            let currentSeq = 1;

            allPieces.forEach(piece => {
                const fits = availableRemnants
                    .filter(r => r.width_cm >= (piece.width - 0.1) && r.remainingLength >= piece.length)
                    .sort((a, b) => a.width_cm - b.width_cm);

                let seqData: any = {
                    seq: currentSeq++,
                    productionItem: piece.productionItem,
                    productionItemId: piece.productionItemId,
                    concluido: piece.concluido
                };

                if (fits.length > 0) {
                    const bestRemnant = fits[0];
                    seqData.source = 'Sobra';
                    seqData.sourceDetail = `${bestRemnant.width_cm}cm x ${bestRemnant.length_m}m`;
                    bestRemnant.remainingLength -= piece.length;
                } else {
                    seqData.source = 'Chapa Nova';
                    seqData.sourceDetail = '120cm';
                }

                pieceToSeq[`${piece.bendId}-${piece.pieceIdx}`] = seqData;
            });

            const newPlan = processedBends.map(b => ({
                ...b,
                sequences: b.lengths.map((_: any, idx: number) => pieceToSeq[`${b.id}-${idx}`])
            }));

            setOptimizedPlan(newPlan);

            // SALVAR NO BANCO DE DADOS
            const itemsToUpdate = [];
            for (const bend of newPlan) {
                for (const seq of bend.sequences) {
                    if (seq.productionItemId) {
                        itemsToUpdate.push({
                            id: seq.productionItemId,
                            sequence_number: seq.seq,
                            material_source: seq.source,
                            source_detail: seq.sourceDetail,
                            estimate_id: estimateId,
                            production_order_id: seq.productionItem?.production_order_id
                        });
                    }
                }
            }

            if (itemsToUpdate.length > 0) {
                await fetch('/api/fabricacao/plan/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: itemsToUpdate }),
                    credentials: 'include'
                });
            }

        } catch (e) {
            console.error('Erro na otimização:', e);
            alert('Erro ao calcular otimização');
        } finally {
            setIsOptimizing(false);
        }
    };

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/fabricacao/${estimateId}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);
                setClientName(data.clientName || 'Cliente');
                setEstimate(data.estimate || null);

                // RECONSTRUIR PLANO OTIMIZADO SE JÁ EXISTIR SEQUENCIAMENTO
                const savedItems = data.items || [];
                const hasPlan = savedItems.some((i: any) => i.sequence_number);

                if (hasPlan && data.estimate) {
                    const estItems = data.estimate.estimate_items || [];
                    const processed = estItems
                        .filter((ei: any) => ei.description.includes('[BEND]'))
                        .map((ei: any, bendIndex: number) => {
                            let bendData: any = {};
                            try { bendData = JSON.parse(ei.description.replace('[BEND]', '')); } catch (e) { return null; }
                            const lengths = Array.isArray(bendData.lengths) ? bendData.lengths.filter((l: any) => parseFloat(l) > 0) : [];

                            const bendId = bendData.id || `bend-${bendIndex}`;

                            // Mapear sequencias salvas para este bend
                            // Nota: A correspondência original era por bendId e pieceIdx
                            // Aqui vamos tentar encontrar os itens que pertencem a este bend
                            const bendPieces = savedItems
                                .filter((si: any) => si.description.includes(bendId) || si.description.includes(bendData.productName))
                                .sort((a: any, b: any) => a.sequence_number - b.sequence_number);

                            if (bendPieces.length === 0) return null;

                            return {
                                id: bendId,
                                room: ei.room || 'Geral',
                                description: bendData.productName || 'Dobra',
                                width: bendData.roundedWidthCm || 0,
                                risks: bendData.risks || [],
                                lengths: bendPieces.map((p: any) => p.metragem),
                                sequences: bendPieces.map((p: any) => ({
                                    seq: p.sequence_number,
                                    productionItemId: p.id,
                                    productionItem: p,
                                    concluido: p.concluido,
                                    source: p.material_source,
                                    sourceDetail: p.source_detail
                                }))
                            };
                        }).filter(Boolean);

                    if (processed.length > 0) setOptimizedPlan(processed);
                }
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
            <style>{printStyles}</style>

            {/* Header (Hidden on Print) */}
            <div className="bg-slate-900 text-white pt-24 pb-12 px-6 print:hidden">
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

                    <button
                        onClick={() => setShowRemnantModal(true)}
                        className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer"
                    >
                        <Layers className="w-5 h-5" /> SOBRAS
                    </button>
                </div>
            </div>

            <main className="max-w-4xl mx-auto -mt-6 px-6">
                {/* Print Only Header */}
                <div className="hidden print:flex items-center justify-between mb-8 border-b-2 border-slate-900 pb-6 pt-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 leading-none">Ferreira Calhas</h1>
                        <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">Relatório de Fabricação Otimizado</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-black text-slate-900">Orçamento #{estimateId?.toUpperCase()}</p>
                        <p className="text-xs font-bold text-slate-500">{clientName}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date().toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                {/* Stats Bar (Hidden on Print) */}
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/60 border border-slate-100 flex items-center justify-between print:hidden">
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
                            className="btn-field bg-green-600 text-white shadow-green-600/20 w-full sm:w-auto self-stretch sm:self-center">
                            <CheckCircle2 className="w-6 h-6" /> {finishing ? 'FINALIZANDO...' : 'FINALIZAR PRODUÇÃO'}
                        </button>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                            <div className="flex-1 w-full sm:text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progresso</p>
                                <div className="w-full sm:w-32 h-3 bg-slate-100 rounded-full mt-2 overflow-hidden border border-slate-200">
                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500 shadow-sm" style={{ width: `${(completedCount / totalCount) * 100 || 0}%` }} />
                                </div>
                            </div>

                            <button
                                onClick={runOptimization}
                                disabled={isOptimizing || items.length === 0}
                                className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                <Zap className={`w-5 h-5 ${isOptimizing ? 'animate-spin' : ''}`} />
                                {isOptimizing ? 'CALCULANDO...' : 'RECALCULAR PLANO'}
                            </button>

                            <button
                                onClick={() => {
                                    // Feedback visual rápido antes de sair
                                    const btn = document.getElementById('btn-save-exit');
                                    if (btn) {
                                        btn.innerHTML = 'SALVO! SAINDO...';
                                        btn.classList.add('bg-green-600', 'text-white');
                                    }
                                    setTimeout(() => navigate(-1), 800);
                                }}
                                id="btn-save-exit"
                                className="btn-field bg-slate-100 text-slate-700 border border-slate-200 shadow-sm w-full sm:w-auto transition-all duration-300">
                                <Save className="w-5 h-5" /> SALVAR E SAIR
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
                        {/* Optimized Plan Display */}
                        {optimizedPlan && (
                            <div className="space-y-8">
                                <div className="flex items-center justify-between px-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center">
                                            <Zap className="w-4 h-4" />
                                        </div>
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                            Relatório de Fabricação Otimizado
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => window.print()}
                                            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                                        >
                                            <Save className="w-3.5 h-3.5" /> IMPRIMIR A4
                                        </button>
                                        <button
                                            onClick={() => setOptimizedPlan(null)}
                                            className="text-slate-400 hover:text-slate-600 text-xs font-bold px-3 py-2 flex items-center gap-1 transition-colors"
                                        >
                                            <RotateCcw className="w-3 h-3" /> VOLTAR
                                        </button>
                                    </div>
                                </div>

                                {(() => {
                                    const groupedPlan: Record<string, any[]> = {};
                                    optimizedPlan.forEach(p => {
                                        const r = p.room || 'Geral';
                                        if (!groupedPlan[r]) groupedPlan[r] = [];
                                        groupedPlan[r].push(p);
                                    });

                                    return Object.entries(groupedPlan).map(([room, roomBends]) => (
                                        <div key={`opt-group-${room}`} className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {room}
                                            </h4>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                {roomBends.map((bend, bIdx) => (
                                                    <div key={`opt-card-${bend.id}`} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full hover:shadow-md transition-shadow print-card">
                                                        <div className="bg-slate-50 px-5 py-3 border-bottom border-slate-100 flex justify-between items-center">
                                                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">
                                                                Dobra #{bIdx + 1} — {(bend.width / 100).toFixed(2)}m larg.
                                                            </p>
                                                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm" />
                                                        </div>

                                                        <div className="p-4 flex flex-col md:flex-row gap-4 flex-1">
                                                            {/* Gráfico da Dobra */}
                                                            <div className="w-full md:w-3/5 min-h-[140px] flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                                                                <div className="w-full scale-90">
                                                                    <BendCanvas risks={bend.risks} exportMode={true} />
                                                                </div>
                                                            </div>

                                                            {/* Lista de Cortes Interativa */}
                                                            <div className="w-full md:w-2/5 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4 flex flex-col">
                                                                <div className="flex-1 space-y-1">
                                                                    {bend.lengths.map((len: number, lIdx: number) => {
                                                                        const seqData = bend.sequences[lIdx];
                                                                        const isDone = items.find(i => i.id === seqData.productionItemId)?.concluido || false;

                                                                        return (
                                                                            <div key={`l-${lIdx}`}
                                                                                onClick={() => seqData.productionItemId && handleToggle({ id: seqData.productionItemId, concluido: isDone })}
                                                                                className={`flex items-center justify-end gap-3 py-1.5 px-3 rounded-xl cursor-pointer transition-all ${isDone ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-transparent hover:border-blue-200 hover:bg-blue-50'}`}
                                                                            >
                                                                                <span className={`text-red-600 font-black text-sm italic mr-auto ${isDone ? 'opacity-30' : ''}`}>
                                                                                    {seqData?.seq}
                                                                                </span>
                                                                                <span className={`text-slate-900 font-black text-xs ${isDone ? 'line-through opacity-40 text-green-700' : ''}`}>
                                                                                    {len.toFixed(2)}m
                                                                                </span>
                                                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}>
                                                                                    {isDone && <CheckCircle className="w-2.5 h-2.5" />}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-center">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                                                                    <span className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                                                                        {bend.lengths.reduce((a: number, c: number) => a + c, 0).toFixed(2)}m
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Info da Origem (Sobra ou Chapa) */}
                                                        <div className="px-4 py-2 bg-slate-900/5 mt-auto border-t border-slate-50 flex items-center gap-2 overflow-hidden">
                                                            <Ruler className="w-3 h-3 text-slate-400" />
                                                            <p className="text-[9px] font-bold text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                                                                {bend.sequences.map((s: any) => `${s.source === 'Sobra' ? 'Sob' : 'Ch'} (${s.sourceDetail})`).join(' | ')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}

                        {!optimizedPlan && Object.entries(groupedItems).map(([room, roomItems]) => {
                            const bendGroups: Record<string, any[]> = {};
                            roomItems.forEach(item => {
                                const desc = item.description.includes('[BEND]') ? item.description : 'Outros';
                                if (!bendGroups[desc]) bendGroups[desc] = [];
                                bendGroups[desc].push(item);
                            });

                            return (
                                <div key={room} className="space-y-6">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> {room}
                                    </h3>

                                    <div className="space-y-4">
                                        {Object.entries(bendGroups).map(([desc, bItems], bIdx) => {
                                            let risks: any[] = [];
                                            let width = 0;
                                            if (desc.includes('[BEND]')) {
                                                try {
                                                    const data = JSON.parse(desc.replace('[BEND]', ''));
                                                    risks = data.risks || [];
                                                    width = data.roundedWidthCm || 0;
                                                } catch (e) { }
                                            }

                                            return (
                                                <div key={`${room}-${bIdx}`} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm flex items-stretch hover:border-blue-200 transition-colors print-card">
                                                    {/* Gráfico da Dobra (Referência lateral) */}
                                                    <div className="w-48 bg-slate-50 border-r border-slate-100 flex flex-col items-center justify-center p-4">
                                                        {risks.length > 0 ? (
                                                            <>
                                                                <div className="w-full scale-75 h-24">
                                                                    <BendCanvas risks={risks} exportMode={true} />
                                                                </div>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase mt-2">
                                                                    {(width / 100).toFixed(2)}m larg.
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <Package className="w-8 h-8 text-slate-200" />
                                                        )}
                                                    </div>

                                                    {/* Lista de Cortes em Linhas (Ticagem) */}
                                                    <div className="flex-1 divide-y divide-slate-50">
                                                        {bItems.map((item) => (
                                                            <div key={item.id}
                                                                onClick={() => handleToggle(item)}
                                                                className={`flex items-center gap-4 p-4 transition-all cursor-pointer hover:bg-blue-50/30 group`}>
                                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.concluido ? 'bg-green-500 border-green-500 text-white' : 'border-slate-200 group-hover:border-blue-300'}`}>
                                                                    {item.concluido && <CheckCircle className="w-4 h-4" />}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className={`font-bold text-sm transition-all ${item.concluido ? 'line-through opacity-40 text-slate-500' : 'text-slate-900'}`}>
                                                                        {item.metragem.toFixed(2).replace('.', ',')}m — {item.description.includes('[BEND]') ? 'Dobra' : item.description}
                                                                    </p>
                                                                </div>
                                                                {item.concluido && (
                                                                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest mr-2">Concluído</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {/* Footer do Bloco com Total */}
                                                        <div className="bg-slate-50/50 px-4 py-2 flex justify-between items-center">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Metragem Total:</span>
                                                            <span className="text-xs font-black text-slate-900">
                                                                {bItems.reduce((a, c) => a + c.metragem, 0).toFixed(2)}m
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* REMNANT MANAGER MODAL */}
            <AnimatePresence>
                {showRemnantModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowRemnantModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
                        >
                            <div className="bg-slate-900 px-8 py-6 flex items-center justify-between text-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                        <Layers className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-xl font-black">Banco de Sobras</h2>
                                </div>
                                <button onClick={() => setShowRemnantModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-8">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Largura (cm)</label>
                                        <input
                                            type="number" value={newWidth} onChange={e => setNewWidth(e.target.value)}
                                            placeholder="Ex: 40"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Comprimento (m)</label>
                                        <input
                                            type="number" value={newLength} onChange={e => setNewLength(e.target.value)}
                                            placeholder="Ex: 3.5"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            onClick={handleAddRemnant}
                                            disabled={addingRemnant || !newWidth || !newLength}
                                            className="w-full bg-blue-500 text-white font-black py-3.5 rounded-2xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/10 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <Plus className="w-5 h-5" /> ADICIONAR
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Sobras Disponíveis</h3>
                                    {remnants.length === 0 ? (
                                        <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                                            <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                            <p className="text-slate-400 text-sm font-bold">Nenhuma sobra cadastrada.</p>
                                        </div>
                                    ) : (
                                        remnants.map(rem => (
                                            <div key={rem.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center font-black text-slate-400 text-xs">
                                                        {rem.width_cm}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">{rem.width_cm} cm <span className="text-slate-400 mx-1">x</span> {rem.length_m} metros</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Adicionado em {new Date(rem.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteRemnant(rem.id)}
                                                    className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

