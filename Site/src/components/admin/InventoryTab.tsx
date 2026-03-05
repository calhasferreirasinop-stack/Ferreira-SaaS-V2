import React, { useState, useEffect } from 'react';
import { Plus, AlertTriangle, Trash2, Package, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';

interface Props {
    inventory: any[];
    onSave: () => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
}

const emptyForm = {
    description: '', widthM: '1.2', lengthM: '33',
    costPerUnit: '', quantity: '1', notes: '', lowStockThresholdM2: '5'
};

export default function InventoryTab({ inventory, onSave, showToast }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'stock' | 'movements'>('stock');
    const [movements, setMovements] = useState<any[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(false);
    const [globalThreshold, setGlobalThreshold] = useState(10);

    const totalAvailable = inventory.reduce((s, i) => s + parseFloat(i.availableM2 || 0), 0);
    // Global low stock: check total sum of ALL bobinas
    const isGlobalLowStock = totalAvailable < globalThreshold;

    const totalCost = (parseFloat(form.costPerUnit) || 0) * (parseInt(form.quantity) || 1);
    const totalM2perEntry = (parseFloat(form.widthM) || 1.2) * (parseFloat(form.lengthM) || 33) * (parseInt(form.quantity) || 1);

    useEffect(() => {
        if (activeSubTab === 'movements') fetchMovements();
    }, [activeSubTab]);

    const fetchMovements = async () => {
        setLoadingMovements(true);
        try {
            const res = await fetch('/api/inventory/movements', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setMovements(data || []);
            }
        } catch { /* ignore */ }
        finally { setLoadingMovements(false); }
    };

    const handleAdd = async () => {
        setLoading(true);
        try {
            const qty = parseInt(form.quantity) || 1;
            const entries = [];
            for (let i = 0; i < qty; i++) {
                entries.push({
                    description: form.description,
                    widthM: parseFloat(form.widthM),
                    lengthM: parseFloat(form.lengthM),
                    costPerUnit: parseFloat(form.costPerUnit) || 0,
                    notes: form.notes,
                    lowStockThresholdM2: parseFloat(form.lowStockThresholdM2) || 5,
                });
            }
            const res = await fetch('/api/inventory/batch', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries }), credentials: 'include',
            });
            if (!res.ok) {
                await fetch('/api/inventory', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, quantity: qty }), credentials: 'include',
                });
            }
            showToast(`${qty} bobina(s) adicionada(s)!`, 'success');
            setForm(emptyForm); setShowForm(false); onSave();
        } catch (e: any) { showToast(e.message || 'Erro', 'error'); }
        finally { setLoading(false); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Remover bobina?')) return;
        await fetch(`/api/inventory/${id}`, { method: 'DELETE', credentials: 'include' });
        showToast('Bobina removida', 'success'); onSave();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-2xl font-bold">Estoque de Bobinas</h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowForm(!showForm)}
                        className="bg-brand-primary text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all text-sm cursor-pointer">
                        <Plus className="w-4 h-4" /> Adicionar Bobina
                    </button>
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-slate-200 pb-0">
                {([['stock', '📦 Estoque'], ['movements', '📊 Movimentação']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setActiveSubTab(key)}
                        className={`px-4 py-2.5 font-bold text-sm rounded-t-xl transition-all cursor-pointer ${activeSubTab === key ? 'bg-white border border-b-white border-slate-200 text-brand-primary -mb-px' : 'text-slate-500 hover:text-slate-700'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {activeSubTab === 'stock' && (
                <>
                    {/* Summary with GLOBAL threshold */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-blue-50 rounded-2xl p-4">
                            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Total Disponível</p>
                            <p className="text-2xl font-black text-blue-700 mt-1">{totalAvailable.toFixed(2)} m²</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Bobinas</p>
                            <p className="text-2xl font-black text-slate-700 mt-1">{inventory.length}</p>
                        </div>
                        <div className={`rounded-2xl p-4 ${isGlobalLowStock ? 'bg-red-50 border border-red-200' : 'bg-green-50'}`}>
                            <p className={`text-xs font-bold uppercase tracking-wider ${isGlobalLowStock ? 'text-red-600' : 'text-green-600'}`}>
                                {isGlobalLowStock ? '⚠ Estoque Baixo!' : '✓ Estoque OK'}
                            </p>
                            <p className={`text-sm mt-1 ${isGlobalLowStock ? 'text-red-500' : 'text-green-500'}`}>
                                Mínimo: {globalThreshold} m²
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4">
                            <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Alerta Global (m²)</label>
                            <input type="number" value={globalThreshold} onChange={e => setGlobalThreshold(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary" />
                        </div>
                    </div>

                    {/* Add form */}
                    {showForm && (
                        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2"><Package className="w-4 h-4 text-brand-primary" />Nova Bobina</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {[
                                    { label: 'Descrição', key: 'description', ph: 'Ex: Galvanizada #26', span2: true },
                                    { label: 'Largura (m)', key: 'widthM', ph: '1.2' },
                                    { label: 'Comprimento (m)', key: 'lengthM', ph: '33' },
                                    { label: '🔢 Quantidade de bobinas', key: 'quantity', ph: '1', highlight: true },
                                    { label: 'Custo unitário (R$)', key: 'costPerUnit', ph: '450.00' },
                                    { label: 'Observações', key: 'notes', ph: 'Fornecedor, tipo...', span2: true },
                                ].map(f => (
                                    <div key={f.key} className={f.span2 ? 'col-span-2' : ''}>
                                        <label className={`text-xs font-bold uppercase ml-1 block mb-1 ${f.highlight ? 'text-brand-primary' : 'text-slate-500'}`}>{f.label}</label>
                                        <input value={(form as any)[f.key]} placeholder={f.ph}
                                            type={(['quantity', 'costPerUnit', 'widthM', 'lengthM'].includes(f.key)) ? 'number' : 'text'}
                                            min={f.key === 'quantity' ? '1' : undefined}
                                            onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                                            className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary ${f.highlight ? 'border-brand-primary/40 bg-brand-primary/5' : 'border-slate-200'}`} />
                                    </div>
                                ))}
                            </div>
                            {(parseFloat(form.quantity) > 1 || parseFloat(form.costPerUnit) > 0) && (
                                <div className="bg-blue-50 rounded-2xl p-4 grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs text-blue-600 font-bold uppercase">Custo Total</p>
                                        <p className="text-xl font-black text-blue-700 mt-1">R$ {totalCost.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-600 font-bold uppercase">m² Total</p>
                                        <p className="text-xl font-black text-blue-700 mt-1">{totalM2perEntry.toFixed(2)} m²</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 cursor-pointer">Cancelar</button>
                                <button onClick={handleAdd} disabled={loading}
                                    className="px-6 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm cursor-pointer hover:opacity-90 disabled:opacity-50">
                                    {loading ? 'Salvando…' : `Adicionar${parseInt(form.quantity) > 1 ? ` ${form.quantity} bobinas` : ' bobina'}`}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bobina list */}
                    <div className="space-y-3">
                        {inventory.length === 0 && <p className="text-slate-400 text-center py-8">Nenhuma bobina cadastrada.</p>}
                        {inventory.map(inv => {
                            const pct = (parseFloat(inv.availableM2) / (parseFloat(inv.widthM) * parseFloat(inv.lengthM))) * 100;
                            return (
                                <div key={inv.id} className="bg-white border border-slate-100 rounded-2xl p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-900">{inv.description || `Bobina #${inv.id}`}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{inv.widthM}m × {inv.lengthM}m · {new Date(inv.purchasedAt).toLocaleDateString('pt-BR')}</p>
                                            {inv.costPerUnit && <p className="text-xs text-slate-500 mt-0.5">Custo unit.: R$ {parseFloat(inv.costPerUnit).toFixed(2)}</p>}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-black text-slate-900">{parseFloat(inv.availableM2).toFixed(2)} m²</p>
                                            <p className="text-xs text-slate-400">disponível</p>
                                        </div>
                                        <button onClick={() => handleDelete(inv.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl cursor-pointer">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${pct < 20 ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{pct.toFixed(0)}% restante</p>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {activeSubTab === 'movements' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-900">Movimentação de Estoque</h3>
                        <button onClick={fetchMovements} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center gap-2 cursor-pointer">
                            <RefreshCw className={`w-4 h-4 ${loadingMovements ? 'animate-spin' : ''}`} /> Atualizar
                        </button>
                    </div>

                    {loadingMovements ? (
                        <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
                    ) : movements.length === 0 ? (
                        <p className="text-slate-400 text-center py-8">Nenhuma movimentação registrada.</p>
                    ) : (
                        <div className="space-y-2">
                            {movements.map((m, i) => (
                                <div key={m.id || i} className={`bg-white border rounded-2xl p-4 flex items-center gap-4 ${m.type === 'consumption' ? 'border-red-100' : m.type === 'restoration' ? 'border-blue-100' : 'border-green-100'}`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${m.type === 'consumption' ? 'bg-red-100 text-red-600' :
                                            m.type === 'restoration' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                                        }`}>
                                        {m.type === 'consumption' ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.type === 'consumption' ? 'bg-red-100 text-red-700' :
                                                    m.type === 'restoration' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {m.type === 'consumption' ? 'SAÍDA' : m.type === 'restoration' ? 'DEVOLUÇÃO' : 'ENTRADA'}
                                            </span>
                                            {m.quoteId && <span className="text-xs text-slate-500">Orçamento #{m.quoteId}</span>}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {m.inventoryDescription || `Bobina #${m.inventoryId}`}
                                            {' · '}{new Date(m.createdAt).toLocaleDateString('pt-BR')} {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-black text-lg ${m.type === 'consumption' ? 'text-red-600' : 'text-green-600'}`}>
                                            {m.type === 'consumption' ? '-' : '+'}{parseFloat(m.m2Amount).toFixed(2)} m²
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
