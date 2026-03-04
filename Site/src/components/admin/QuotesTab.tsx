import React, { useState, useEffect } from 'react';
import { Eye, Check, X, Package, ChevronDown, Percent, PenLine, ZoomIn, RefreshCw, RotateCcw, FileDown } from 'lucide-react';

const DIRECTION_ICONS: Record<string, string> = {
    left: '←', right: '→', up: '↑', down: '↓',
    upLeft: '↖', upRight: '↗', downLeft: '↙', downRight: '↘',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    rascunho: { label: 'Rascunho', color: 'bg-slate-100 text-slate-500' },
    pending: { label: 'Aguardando Pgto', color: 'bg-yellow-100 text-yellow-700' },
    paid: { label: 'Pago', color: 'bg-green-100 text-green-700' },
    in_production: { label: 'Em Produção', color: 'bg-blue-100 text-blue-700' },
    finished: { label: 'Finalizado', color: 'bg-slate-100 text-slate-600' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

const ALL_STATUSES = [
    { value: 'pending', label: '⏳ Aguardando Pagamento' },
    { value: 'paid', label: '✅ Pago' },
    { value: 'in_production', label: '🏭 Em Produção' },
    { value: 'finished', label: '🎯 Finalizado' },
    { value: 'cancelled', label: '❌ Cancelado' },
];

interface Props {
    quotes: any[];
    currentUser: any;
    onSave: () => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
}

const emptyManual = { clientName: '', totalValue: '', totalM2: '', notes: '', status: 'paid' };

export default function QuotesTab({ quotes, currentUser, onSave, showToast }: Props) {
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [bendsMap, setBendsMap] = useState<Record<number, any[]>>({});
    const [loadingBends, setLoadingBends] = useState<number | null>(null);
    const [zoomImg, setZoomImg] = useState<string | null>(null);
    const [discountModal, setDiscountModal] = useState<any>(null);
    const [discountVal, setDiscountVal] = useState('');
    const [discountReason, setDiscountReason] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [manualForm, setManualForm] = useState(emptyManual);
    const [creating, setCreating] = useState(false);
    const [reopenConfirm, setReopenConfirm] = useState<any>(null);
    const [statusFilter, setStatusFilter] = useState('all');

    const isAdminOrMaster = currentUser?.role === 'admin' || currentUser?.role === 'master';
    const isMaster = currentUser?.role === 'master';

    const handleDownloadPDF = async (q: any, qBends: any[]) => {
        let sett: Record<string, string> = {};
        try { const r = await fetch('/api/admin/data', { credentials: 'include' }); if (r.ok) { const d = await r.json(); sett = d.settings || {}; } } catch { }
        const pm2 = parseFloat(sett.pricePerM2 || '50');
        const imgRows = qBends.map((b: any, i: number) => {
            const cuts = Array.isArray(b.lengths) ? b.lengths.filter((l: any) => parseFloat(l) > 0) : [];
            const cutsHtml = cuts.length > 0 ? `<table class="cuts-table"><thead><tr><th colspan="2">Cortes</th></tr></thead><tbody>${cuts.map((c: any, ci: number) => `<tr><td>Corte ${ci + 1}</td><td class="cut-val">${parseFloat(c).toFixed(2)}m</td></tr>`).join('')}<tr class="cut-total"><td>Metros corridos</td><td class="cut-val">${(b.totalLengthM || 0).toFixed(2)}m</td></tr></tbody></table>` : '';
            const img = b.svgDataUrl ? `<img src="${b.svgDataUrl}" style="width:100%;max-height:180px;object-fit:contain;background:#1e293b;border-radius:8px"/>` : '';
            return `<div style="margin:16px 0;page-break-inside:avoid"><p style="font-weight:bold;margin:0 0 8px;font-size:14px">Dobra #${i + 1} \u2014 <span class="medida">${((b.roundedWidthCm || 0) / 100).toFixed(2)}m larg.</span></p><div style="display:flex;gap:16px;align-items:flex-start">${img ? `<div style="flex:1">${img}</div>` : ''}${cutsHtml ? `<div style="flex:0 0 200px">${cutsHtml}</div>` : ''}</div></div>`;
        }).join('');
        const rows = qBends.map((b: any, i: number) => {
            const lengths = Array.isArray(b.lengths) ? b.lengths : [];
            const totalLen = b.totalLengthM || lengths.filter((l: any) => parseFloat(l) > 0).reduce((a: number, c: any) => a + parseFloat(c), 0);
            const w = b.roundedWidthCm || 0; const m2 = b.m2 || (w / 100 * totalLen);
            return `<tr><td>#${i + 1}</td><td>${(b.risks || []).map((r: any) => `${DIRECTION_ICONS[r.direction] || ''} ${r.sizeCm}cm`).join(', ')}</td><td class="medida">${(w / 100).toFixed(2)}m</td><td class="metros">${lengths.filter((l: any) => parseFloat(l) > 0).join('+')}=${totalLen.toFixed(2)}m</td><td>${m2.toFixed(4)}</td><td>R$${(m2 * pm2).toFixed(2)}</td></tr>`;
        }).join('');
        const tM2 = parseFloat(q.totalM2 || 0); const tVal = parseFloat(q.finalValue || q.totalValue || 0);
        const stLabel = (STATUS_CONFIG[q.status]?.label || q.status).toUpperCase();
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Or\u00e7amento #${q.id}</title><style>
body{font-family:Arial,sans-serif;padding:24px;color:#111;max-width:900px;margin:auto}
h1{font-size:20px;margin-bottom:4px}
.status{display:inline-block;background:#fef3c7;color:#92400e;border:2px solid #f59e0b;font-weight:bold;font-size:13px;padding:6px 14px;border-radius:8px;margin:8px 0}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
th{background:#1e293b;color:#fff;text-align:left;padding:10px}
td{padding:8px;border-bottom:1px solid #e8e8e8}
tr:nth-child(even) td{background:#f8fafc}
.big{font-size:18px;font-weight:bold;color:#16a34a}
.metros{font-size:16px;font-weight:bold;background:#eef2ff;border:2px solid #6366f1;padding:6px 12px;border-radius:6px;color:#4338ca}
.medida{font-size:14px;font-weight:bold;color:#1e40af}
.cuts-table{width:100%;border-collapse:collapse;margin:0;font-size:13px;border:2px solid #6366f1;border-radius:8px;overflow:hidden}
.cuts-table th{background:#4338ca;color:#fff;padding:6px 10px;font-size:12px;text-align:center}
.cuts-table td{padding:6px 10px;border-bottom:1px solid #e0e7ff;background:#eef2ff}
.cuts-table .cut-val{font-weight:bold;color:#4338ca;text-align:right;font-size:15px}
.cuts-table .cut-total{background:#c7d2fe}
.cuts-table .cut-total td{font-weight:900;border-bottom:none;font-size:14px}
.report-header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #e2e8f0;padding-bottom:16px;margin-bottom:16px}
.report-header img{height:50px;object-fit:contain}
.report-header .info{font-size:11px;color:#64748b}
.report-footer{border-top:2px solid #e2e8f0;padding-top:12px;margin-top:24px;text-align:center;font-size:11px;color:#94a3b8}
@media print{body{padding:8px}}
</style></head><body>
${sett.reportLogo || sett.reportCompanyName ? `<div class="report-header">${sett.reportLogo ? `<img src="${sett.reportLogo}" alt="Logo"/>` : ''}<div><strong style="font-size:16px">${sett.reportCompanyName || ''}</strong><div class="info">${[sett.reportPhone, sett.reportEmail].filter(Boolean).join(' | ')}${sett.reportAddress ? `<br/>${sett.reportAddress}` : ''}${sett.reportHeaderText ? `<br/>${sett.reportHeaderText}` : ''}</div></div></div>` : ''}
<h1>Or\u00e7amento #${q.id} \u2014 ${sett.reportCompanyName || 'Ferreira Calhas'}</h1>
<p style="color:#555;font-size:12px">${new Date(q.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
<p>Cliente: <b>${q.clientName || ''}</b>${q.notes ? ` | Obs: ${q.notes}` : ''}</p>
<div class="status">\u23f3 STATUS: ${stLabel}</div>
${imgRows}
<table><thead><tr><th>#</th><th>Riscos</th><th>Largura</th><th style="background:#4338ca">Metros corridos</th><th>m\u00b2</th><th>Valor</th></tr></thead><tbody>${rows}</tbody>
<tfoot>
<tr><td colspan="4" align="right">Total m\u00b2:</td><td colspan="2"><b>${tM2.toFixed(4)} m\u00b2</b></td></tr>
<tr><td colspan="4" align="right">Pre\u00e7o/m\u00b2:</td><td colspan="2">R$ ${pm2.toFixed(2)}</td></tr>
<tr><td colspan="4" align="right" style="font-size:18px;font-weight:900">TOTAL:</td><td colspan="2" class="big">R$ ${tVal.toFixed(2)}</td></tr>
</tfoot></table>
${sett.reportFooterText ? `<div class="report-footer">${sett.reportFooterText}</div>` : ''}
<p style="margin-top:16px;color:#888;font-size:11px">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
</body></html>`;
        const b2 = new Blob([html], { type: 'text/html' });
        const bUrl = URL.createObjectURL(b2);
        const w2 = window.open(bUrl, '_blank');
        if (w2) setTimeout(() => URL.revokeObjectURL(bUrl), 10000);
    };

    // Load bends when a quote is expanded
    useEffect(() => {
        if (expandedId == null || bendsMap[expandedId]) return;
        setLoadingBends(expandedId);
        fetch(`/api/quotes/${expandedId}/bends`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then(data => { setBendsMap(prev => ({ ...prev, [expandedId]: data })); })
            .catch(() => setBendsMap(prev => ({ ...prev, [expandedId]: [] })))
            .finally(() => setLoadingBends(null));
    }, [expandedId]);

    const updateStatus = async (id: number, status: string) => {
        const res = await fetch(`/api/quotes/${id}/status`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }), credentials: 'include',
        });
        if (res.ok) { showToast('Status atualizado!', 'success'); onSave(); }
        else showToast('Erro ao atualizar status', 'error');
    };

    const applyDiscount = async () => {
        if (!discountModal) return;
        const res = await fetch(`/api/quotes/${discountModal.id}/discount`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discountValue: parseFloat(discountVal), reason: discountReason }),
            credentials: 'include',
        });
        if (res.ok) {
            showToast('Desconto aplicado!', 'success');
            setDiscountModal(null); setDiscountVal(''); setDiscountReason('');
            onSave();
        } else showToast('Erro ao aplicar desconto', 'error');
    };

    const handleCreateManual = async () => {
        if (!manualForm.clientName || !manualForm.totalValue) return showToast('Preencha cliente e valor', 'error');
        setCreating(true);
        try {
            const res = await fetch('/api/quotes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientName: manualForm.clientName,
                    notes: '[MANUAL] ' + (manualForm.notes || ''),
                    totalValue: parseFloat(manualForm.totalValue),
                    totalM2: parseFloat(manualForm.totalM2) || 0,
                    bends: [], adminCreated: true,
                }),
                credentials: 'include',
            });
            if (!res.ok) throw new Error((await res.json()).error);
            const q = await res.json();
            if (manualForm.status !== 'pending') {
                await fetch(`/api/quotes/${q.id}/status`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: manualForm.status }), credentials: 'include',
                });
            }
            showToast('Orçamento criado!', 'success');
            setManualForm(emptyManual); setShowCreate(false); onSave();
        } catch (e: any) { showToast(e.message || 'Erro ao criar', 'error'); }
        finally { setCreating(false); }
    };

    const filteredQuotes = statusFilter === 'all' ? quotes : quotes.filter(q => q.status === statusFilter);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Zoom modal */}
            {zoomImg && (
                <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4" onClick={() => setZoomImg(null)}>
                    <button className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full cursor-pointer"><X className="w-6 h-6" /></button>
                    <img src={zoomImg} alt="Dobra zoom" className="max-w-full max-h-full rounded-2xl" onClick={e => e.stopPropagation()} />
                </div>
            )}

            <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-2xl font-bold">Orçamentos</h2>
                <div className="flex gap-2 flex-wrap">
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary">
                        <option value="all">Todos os status</option>
                        {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    {isAdminOrMaster && (
                        <button onClick={() => setShowCreate(!showCreate)}
                            className="bg-brand-primary text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 text-sm cursor-pointer">
                            <PenLine className="w-4 h-4" /> Lançar Manual
                        </button>
                    )}
                </div>
            </div>

            {showCreate && isAdminOrMaster && (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2"><PenLine className="w-4 h-4 text-brand-primary" />Lançamento Manual</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { label: 'Nome do Cliente *', key: 'clientName', ph: 'Ex: João Silva' },
                            { label: 'Valor Total (R$) *', key: 'totalValue', ph: 'Ex: 450.00', type: 'number' },
                            { label: 'Quantidade m² de calha', key: 'totalM2', ph: 'Ex: 3.5', type: 'number' },
                            { label: 'Observações', key: 'notes', ph: 'Ex: calha 6m galvanizada' },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{f.label}</label>
                                <input type={f.type || 'text'} value={(manualForm as any)[f.key]} placeholder={f.ph}
                                    onChange={e => setManualForm({ ...manualForm, [f.key]: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-primary" />
                            </div>
                        ))}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status Inicial</label>
                            <select value={manualForm.status} onChange={e => setManualForm({ ...manualForm, status: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-primary">
                                {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => { setShowCreate(false); setManualForm(emptyManual); }}
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 cursor-pointer">Cancelar</button>
                        <button onClick={handleCreateManual} disabled={creating}
                            className="px-6 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm cursor-pointer hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                            <Check className="w-4 h-4" /> {creating ? 'Criando…' : 'Criar Orçamento'}
                        </button>
                    </div>
                </div>
            )}

            {discountModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-2xl">
                        <h3 className="font-bold text-xl flex items-center gap-2"><Percent className="w-5 h-5 text-brand-primary" />Aplicar Desconto</h3>
                        <p className="text-sm text-slate-500">Orçamento #{discountModal.id} — Valor: R$ {parseFloat(discountModal.totalValue || 0).toFixed(2)}</p>
                        <input type="number" placeholder="Valor do desconto (R$)" value={discountVal}
                            onChange={e => setDiscountVal(e.target.value)}
                            className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none" />
                        <input type="text" placeholder="Motivo do desconto" value={discountReason}
                            onChange={e => setDiscountReason(e.target.value)}
                            className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none" />
                        <div className="flex gap-3">
                            <button onClick={() => setDiscountModal(null)} className="flex-1 py-2.5 bg-slate-100 rounded-xl font-bold text-slate-600 cursor-pointer hover:bg-slate-200">Cancelar</button>
                            <button onClick={applyDiscount} className="flex-1 py-2.5 bg-brand-primary text-white rounded-xl font-bold cursor-pointer hover:opacity-90">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats bar */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
                {ALL_STATUSES.map(s => {
                    const count = quotes.filter(q => q.status === s.value).length;
                    const cfg = STATUS_CONFIG[s.value];
                    return (
                        <button key={s.value} onClick={() => setStatusFilter(prev => prev === s.value ? 'all' : s.value)}
                            className={`rounded-xl p-2 border cursor-pointer transition-all ${statusFilter === s.value ? 'ring-2 ring-brand-primary' : ''} ${cfg.color} border-transparent`}>
                            <p className="font-black text-lg">{count}</p>
                            <p className="font-bold opacity-70 text-[10px] leading-tight">{cfg.label}</p>
                        </button>
                    );
                })}
            </div>

            {/* Quotes list */}
            <div className="space-y-3">
                {filteredQuotes.length === 0 && <p className="text-slate-400 text-center py-8">Nenhum orçamento encontrado.</p>}
                {filteredQuotes.map(q => {
                    const st = STATUS_CONFIG[q.status] || STATUS_CONFIG.pending;
                    const isExpanded = expandedId === q.id;
                    const bends = bendsMap[q.id] || [];
                    return (
                        <div key={q.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-sm transition-all">
                            {/* Row */}
                            <div className="p-4 flex items-center gap-4 flex-wrap cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : q.id)}>
                                <span className="font-black text-slate-300 text-sm">#{q.id}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-900 flex items-center gap-2">{q.clientName || 'Cliente'}{q.notes?.startsWith('[MANUAL]') && <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">MANUAL</span>}</p>
                                    <p className="text-xs text-slate-400">{new Date(q.createdAt).toLocaleString('pt-BR')}{q.notes ? ` · ${q.notes.replace('[MANUAL] ', '').substring(0, 40)}` : ''}</p>
                                </div>
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${st.color}`}>{st.label}</span>
                                <div className="text-right">
                                    <p className="font-black text-slate-900">R$ {parseFloat(q.finalValue || q.totalValue || 0).toFixed(2)}</p>
                                    <p className="text-xs text-slate-400">{parseFloat(q.totalM2 || 0).toFixed(4)} m²</p>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                                <div className="border-t border-slate-100 p-5 space-y-5 bg-slate-50">
                                    {/* Bend photos — MOST IMPORTANT */}
                                    {loadingBends === q.id ? (
                                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                                            <RefreshCw className="w-4 h-4 animate-spin" /> Carregando dobras...
                                        </div>
                                    ) : bends.length > 0 ? (
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">📐 Dobras ({bends.length})</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {bends.map((b: any, i: number) => (
                                                    <div key={b.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                                        {b.svgDataUrl ? (
                                                            <div className="relative group cursor-pointer" onClick={() => setZoomImg(b.svgDataUrl)}>
                                                                <img src={b.svgDataUrl} alt={`Dobra ${i + 1}`}
                                                                    className="w-full object-contain group-hover:opacity-90 transition-opacity"
                                                                    style={{ height: 120, background: '#1e293b' }} />
                                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <ZoomIn className="w-6 h-6 text-white" />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="h-20 bg-slate-100 flex items-center justify-center text-slate-400 text-xs">Sem imagem</div>
                                                        )}
                                                        <div className="p-3">
                                                            <p className="font-bold text-slate-800 text-sm">Dobra {b.bendOrder}</p>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                {(b.roundedWidthCm / 100).toFixed(2)}m × {b.totalLengthM?.toFixed(2)}m
                                                            </p>
                                                            <p className="text-xs text-blue-600 font-bold">{b.m2?.toFixed(4)} m²</p>
                                                            {b.risks && Array.isArray(b.risks) && (
                                                                <p className="text-xs text-slate-400 mt-1 truncate">
                                                                    {b.risks.map((r: any) => `${r.direction} ${r.sizeCm}cm`).join(' · ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">Orçamento manual — sem dobras cadastradas.</p>
                                    )}

                                    {/* Info row */}
                                    <div className="flex flex-wrap gap-4 text-sm">
                                        {q.pixProofUrl && (
                                            <a href={q.pixProofUrl} target="_blank" rel="noopener"
                                                className="flex items-center gap-2 text-sm font-bold text-brand-primary bg-brand-primary/10 px-4 py-2 rounded-xl w-fit">
                                                <Eye className="w-4 h-4" /> Ver Comprovante PIX
                                            </a>
                                        )}
                                        <button onClick={() => handleDownloadPDF(q, bends)}
                                            className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl cursor-pointer hover:bg-indigo-100">
                                            <FileDown className="w-4 h-4" /> Baixar PDF
                                        </button>
                                        {q.discountValue > 0 && (
                                            <p className="text-slate-500">Desconto: <span className="text-red-500 font-bold">-R$ {parseFloat(q.discountValue).toFixed(2)}</span></p>
                                        )}
                                        {q.notes && <p className="text-slate-600 italic">"{q.notes}"</p>}
                                    </div>

                                    {/* Status actions */}
                                    {isAdminOrMaster && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Alterar Status</p>
                                            <div className="flex flex-wrap gap-2">
                                                {q.status !== 'paid' && (
                                                    <button onClick={() => updateStatus(q.id, 'paid')}
                                                        className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 cursor-pointer flex items-center gap-1">
                                                        <Check className="w-3.5 h-3.5" /> Marcar Pago
                                                    </button>
                                                )}
                                                {q.status !== 'in_production' && (
                                                    <button onClick={() => updateStatus(q.id, 'in_production')}
                                                        className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-xl hover:bg-blue-600 cursor-pointer flex items-center gap-1">
                                                        <Package className="w-3.5 h-3.5" /> Enviar Produção
                                                    </button>
                                                )}
                                                {q.status !== 'finished' && (
                                                    <button onClick={() => updateStatus(q.id, 'finished')}
                                                        className="px-3 py-1.5 bg-slate-700 text-white text-xs font-bold rounded-xl hover:bg-slate-800 cursor-pointer flex items-center gap-1">
                                                        <Check className="w-3.5 h-3.5" /> Finalizar
                                                    </button>
                                                )}
                                                {q.status !== 'pending' && (
                                                    <button onClick={() => {
                                                        if (['paid', 'in_production', 'finished'].includes(q.status)) {
                                                            setReopenConfirm(q);
                                                        } else {
                                                            updateStatus(q.id, 'pending');
                                                        }
                                                    }}
                                                        className="px-3 py-1.5 bg-yellow-500 text-white text-xs font-bold rounded-xl hover:bg-yellow-600 cursor-pointer flex items-center gap-1">
                                                        <RotateCcw className="w-3.5 h-3.5" /> Reabrir
                                                    </button>
                                                )}
                                                {q.status !== 'cancelled' && (
                                                    <button onClick={() => updateStatus(q.id, 'cancelled')}
                                                        className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 cursor-pointer flex items-center gap-1">
                                                        <X className="w-3.5 h-3.5" /> Cancelar
                                                    </button>
                                                )}
                                                {isMaster && q.status !== 'paid' && (
                                                    <button onClick={() => setDiscountModal(q)}
                                                        className="px-3 py-1.5 bg-purple-500 text-white text-xs font-bold rounded-xl hover:bg-purple-600 cursor-pointer flex items-center gap-1">
                                                        <Percent className="w-3.5 h-3.5" /> Desconto
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {/* User can cancel unpaid quotes */}
                                    {!isAdminOrMaster && q.status !== 'paid' && q.status !== 'cancelled' && q.status !== 'finished' && (
                                        <div>
                                            <button onClick={() => updateStatus(q.id, 'cancelled')}
                                                className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 cursor-pointer flex items-center gap-1">
                                                <X className="w-3.5 h-3.5" /> Cancelar Orçamento
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Reopen confirmation modal */}
            {reopenConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full space-y-4 shadow-2xl">
                        <h3 className="font-bold text-xl flex items-center gap-2 text-amber-600">
                            ⚠️ Atenção — Reabrir Orçamento
                        </h3>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                            <p className="text-sm text-amber-800 font-bold">Orçamento #{reopenConfirm.id} — {reopenConfirm.clientName}</p>
                            <p className="text-sm text-amber-700">Este orçamento já possui <strong>pagamento efetuado</strong> ou está em produção/finalizado.</p>
                            <p className="text-sm text-amber-700">Ao reabrir:</p>
                            <ul className="text-sm text-amber-700 list-disc pl-5 space-y-1">
                                <li>O registro financeiro será <strong>removido</strong></li>
                                <li>O estoque consumido será <strong>devolvido</strong></li>
                                <li>As movimentações de estoque serão <strong>excluídas</strong></li>
                                <li>A diferença será <strong>adicionada/recarregada</strong> ao reprocessar</li>
                            </ul>
                        </div>
                        <p className="text-sm text-slate-600">Tem certeza que deseja reabrir este orçamento?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setReopenConfirm(null)}
                                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 cursor-pointer">Cancelar</button>
                            <button onClick={() => { updateStatus(reopenConfirm.id, 'pending'); setReopenConfirm(null); }}
                                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm cursor-pointer flex items-center justify-center gap-2">
                                <RotateCcw className="w-4 h-4" /> Confirmar Reabertura
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
