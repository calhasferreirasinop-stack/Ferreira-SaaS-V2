import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, ChevronRight, ChevronLeft, Check, AlertTriangle, Printer, Copy, Send, RefreshCw, Undo2, FileDown, ZoomIn, X, PenLine, Save, List, Eye, CreditCard, Triangle, RotateCcw, Filter, ShoppingCart, GitBranch, Factory, RefreshCcw, XCircle, Hammer } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import BendCanvas, { Risk, RiskDirection, DIRECTION_ICONS, OPPOSITE_DIRECTION } from '../components/BendCanvas';
import { useOfflineSync } from '../hooks/useOfflineSync';

// ─── Official rounding rule ────────────────────────────────────────────────────
// floor to nearest 5, compute remainder. If remainder > 1 → round UP, else stay.
// 6→5, 6.01→10, 11→10, 11.01→15, 22→25, 16→15, 16.01→20
function roundToMultipleOf5(value: number): number {
    if (value <= 0) return 5;
    const lower = Math.floor(value / 5) * 5;
    const remainder = value - lower;
    return remainder > 1 ? lower + 5 : (lower || 5);
}

interface Bend {
    id: string;
    group_id?: string;
    group_name?: string;
    risks: Risk[];
    totalWidthCm: number;
    roundedWidthCm: number;
    lengths: string[];
    totalLengthM: number;
    m2: number;
    svgDataUrl?: string;
    productType?: 'product' | 'service';
    serviceDescription?: string;
    serviceValue?: number;
    serviceQty?: number;
    product_id?: string;
}
interface SavedBend { id?: string; risks: Risk[]; roundedWidthCm: number; useCount: number; svgDataUrl?: string; product_id?: string; }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: 'Rascunho', color: 'bg-slate-500' },
    rascunho: { label: 'Rascunho', color: 'bg-slate-500' },
    pending: { label: 'Aguardando Pgto', color: 'bg-yellow-500' },
    paid: { label: 'Pago', color: 'bg-green-500' },
    in_production: { label: 'Em Produção', color: 'bg-blue-500' },
    finished: { label: 'Finalizado', color: 'bg-slate-600' },
    cancelled: { label: 'Cancelado', color: 'bg-red-500' },
};

const PROD_STATUS: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
    pending: { label: '⏳ Pendente', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', next: 'accepted', nextLabel: '✅ Aceitar' },
    accepted: { label: '✅ Aceito', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', next: 'in_production', nextLabel: '🏭 Iniciar Produção' },
    in_production: { label: '🏭 Em Produção', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', next: 'ready', nextLabel: '📦 Marcar Pronto' },
    ready: { label: '📦 Pronto', color: 'bg-green-500/20 text-green-400 border-green-500/30', next: 'delivered', nextLabel: '🚛 Entregue' },
    delivered: { label: '🚛 Entregue', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

// ─── Direction grid ───────────────────────────────────────────────────────────
const DIR_GRID: { dir: RiskDirection; icon: string; label: string; grad: string }[] = [
    { dir: 'upLeft', icon: '↖', label: 'Cima-Esq', grad: 'from-violet-500 to-violet-600' },
    { dir: 'up', icon: '↑', label: 'Cima', grad: 'from-blue-500 to-blue-600' },
    { dir: 'upRight', icon: '↗', label: 'Cima-Dir', grad: 'from-cyan-500 to-cyan-600' },
    { dir: 'left', icon: '←', label: 'Esquerda', grad: 'from-orange-500 to-orange-600' },
    { dir: 'right', icon: '→', label: 'Direita', grad: 'from-green-500 to-green-600' },
    { dir: 'downLeft', icon: '↙', label: 'Baixo-Esq', grad: 'from-pink-500 to-pink-600' },
    { dir: 'down', icon: '↓', label: 'Baixo', grad: 'from-red-500 to-red-600' },
    { dir: 'downRight', icon: '↘', label: 'Baixo-Dir', grad: 'from-amber-500 to-amber-600' },
];

const MAX_W = 120;
const uid = () => Math.random().toString(36).slice(2);
const sumRisks = (risks: Risk[]) => risks.reduce((s, r) => s + (parseFloat(String(r.sizeCm)) || 0), 0);
function calcM2(roundedWidthCm: number, lengths: string[]) {
    const vals = lengths.map(l => parseFloat(l)).filter(v => v > 0);
    const totalLengthM = vals.reduce((a, b) => a + b, 0);
    return { totalLengthM, m2: (roundedWidthCm / 100) * totalLengthM };
}
async function captureSvg(el: SVGSVGElement): Promise<string> {
    return new Promise(resolve => {
        try {
            // Clone SVG and remove edit-mode elements (INÍCIO label, grid)
            const clone = el.cloneNode(true) as SVGSVGElement;
            // Remove INÍCIO text and info bar text
            clone.querySelectorAll('text').forEach(t => {
                const txt = t.textContent?.trim() || '';
                if (txt === 'INÍCIO' || txt.includes('Adicione riscos')) t.remove();
            });
            // Remove grid lines (very faint ones)
            clone.querySelectorAll('line').forEach(l => {
                const s = l.getAttribute('stroke') || '';
                if (s.includes('0.035')) l.remove();
            });
            // Remove real sum circle for export
            clone.querySelectorAll('g').forEach(g => {
                if (g.textContent?.includes('SOMA REAL')) g.remove();
            });
            const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas'); c.width = 920; c.height = 440;
                const ctx = c.getContext('2d')!;
                ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 920, 440);
                ctx.drawImage(img, 0, 0, 920, 440);
                URL.revokeObjectURL(url);
                resolve(c.toDataURL('image/png'));
            };
            img.onerror = () => resolve('');
            img.src = url;
            // Safety timeout to prevent freeze
            setTimeout(() => resolve(''), 2000);
        } catch { resolve(''); }
    });
}

const calculateOptimization = (allBends: Bend[]) => {
    const BIN_CAPACITY = 1.2; // 1.20m sheet
    let optimizationPool: { bendId: string, originalIdx: number, length: number }[] = [];
    let bins: { pieces: { bendId: string, originalIdx: number, length: number }[], scrap: number }[] = [];
    let pieceToSeq: Record<string, number[]> = {};

    // 1. Process pieces
    allBends.forEach(b => {
        if (!b.lengths || !Array.isArray(b.lengths)) return;
        b.lengths.forEach((lenStr, idx) => {
            let len = parseFloat(lenStr);
            if (isNaN(len) || len <= 0) return;

            const key = `${b.id}-${idx}`;
            if (!pieceToSeq[key]) pieceToSeq[key] = [];

            // If piece is longer than a standard sheet, consume full sheets first
            while (len >= BIN_CAPACITY - 0.001) {
                // Create a dedicated bin for this full section
                const fullBinIdx = bins.length;
                bins.push({
                    pieces: [{ bendId: b.id, originalIdx: idx, length: BIN_CAPACITY }],
                    scrap: 0
                });
                pieceToSeq[key].push(fullBinIdx + 1);
                len -= BIN_CAPACITY;
            }

            // Any remainder goes to the pool to be optimized with others
            if (len > 0.005) {
                optimizationPool.push({ bendId: b.id, originalIdx: idx, length: len });
            }
        });
    });

    // 2. Sort pool descending (Standard FFD) for the remainders
    const sortedPool = [...optimizationPool].sort((a, b) => b.length - a.length);

    // 3. First Fit Decreasing for the remainders
    sortedPool.forEach(p => {
        let found = false;
        // Only try to fit in bins that weren't "full sheet" reservations (bins with scrap > 0 or newly created)
        // Actually, any bin with enough space works.
        for (let i = 0; i < bins.length; i++) {
            let bin = bins[i];
            let currentUsed = bin.pieces.reduce((s, x) => s + x.length, 0);
            if (currentUsed + p.length <= BIN_CAPACITY + 0.001) {
                bin.pieces.push(p);
                const key = `${p.bendId}-${p.originalIdx}`;
                pieceToSeq[key].push(i + 1);
                found = true;
                break;
            }
        }

        if (!found) {
            const newBinIdx = bins.length;
            bins.push({ pieces: [p], scrap: 0 });
            const key = `${p.bendId}-${p.originalIdx}`;
            pieceToSeq[key].push(newBinIdx + 1);
        }
    });

    // Final scrap calculation
    bins.forEach(bin => {
        const used = bin.pieces.reduce((s, x) => s + x.length, 0);
        bin.scrap = BIN_CAPACITY - used;
    });

    return { bins, pieceToSeq };
};

export default function Orcamento() {
    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const { isOnline, saveOffline } = useOfflineSync();
    const [user, setUser] = useState<any>(null);
    const [settings, setSettings] = useState<any>({});
    const [step, setStep] = useState<'bends' | 'summary' | 'payment' | 'success'>('bends');
    const [bends, setBends] = useState<Bend[]>([]);

    // Quotes listing
    const [myQuotes, setMyQuotes] = useState<any[]>([]);
    const [showMyQuotes, setShowMyQuotes] = useState(true);
    const [clientName, setClientName] = useState('');
    const [pixKeys, setPixKeys] = useState<any[]>([]);
    const [savingDraft, setSavingDraft] = useState(false);
    const [libraryZoom, setLibraryZoom] = useState<SavedBend | null>(null);
    const [loadingQuoteId, setLoadingQuoteId] = useState<string | number | null>(null);

    // Cancellation states
    const [cancelModalQuote, setCancelModalQuote] = useState<any>(null);
    const [cancelReason, setCancelReason] = useState<string>('');
    const [cancelReasonText, setCancelReasonText] = useState<string>('');
    const [canceling, setCanceling] = useState(false);

    // ── Client autocomplete ───────────────────────────────────────────────────
    const [allClients, setAllClients] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    // Quick create client modal
    const [showQuickClient, setShowQuickClient] = useState(false);
    const [quickClientForm, setQuickClientForm] = useState({ name: '', phone: '', email: '' });
    const [quickClientSaving, setQuickClientSaving] = useState(false);

    // ── Product selector ──────────────────────────────────────────────────────
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [selectedProductName, setSelectedProductName] = useState<string>('');
    const [selectedProductType, setSelectedProductType] = useState<'product' | 'service'>('product');

    // Quick create service modal
    const [showQuickService, setShowQuickService] = useState(false);
    const [quickServiceForm, setQuickServiceForm] = useState({ name: '', description: '', price: '', stock_quantity: '', unit: 'un', type_product: 'product' as 'product' | 'service' });
    const [quickServiceSaving, setQuickServiceSaving] = useState(false);

    // ── Service mode fields ────────────────────────────────────────────────
    const [serviceDescription, setServiceDescription] = useState('');
    const [serviceValue, setServiceValue] = useState('');
    const [serviceQty, setServiceQty] = useState('1');
    const [editingQuoteId, setEditingQuoteId] = useState<string | number | null>(null);
    const [overridePricePerM2, setOverridePricePerM2] = useState<string>('');
    const [overrideCostPerM2, setOverrideCostPerM2] = useState<string>('');
    const [discountAmount, setDiscountAmount] = useState<string>('');

    const pricePerM2 = isNaN(parseFloat(overridePricePerM2)) ? parseFloat(settings.pricePerM2 || '50') : parseFloat(overridePricePerM2);
    const costPerM2 = isNaN(parseFloat(overrideCostPerM2)) ? parseFloat(settings.costPerM2 || '30') : parseFloat(overrideCostPerM2);

    const totalM2 = bends.reduce((acc, b) => acc + (b.m2 || 0), 0);
    const totalValue = bends.reduce((acc, b) => {
        if (b.productType === 'service') return acc + ((b.serviceValue || 0) * (b.serviceQty || 1));
        return acc + (b.m2 * pricePerM2);
    }, 0);
    const totalCostValue = bends.reduce((acc, b) => {
        if (b.productType === 'service') return acc;
        return acc + (b.m2 * costPerM2);
    }, 0);

    const finalWithDiscount = totalValue - (parseFloat(discountAmount) || 0);
    const profit = finalWithDiscount - totalCostValue;
    const getBendExecutionLabels = (bendId: string, bendLengths: string[] | number[]) => {
        if (!optResult || !optResult.pieceToSeq) return undefined;
        const labels: number[] = [];
        (bendLengths || []).forEach((l, i) => {
            const seq = optResult.pieceToSeq[`${bendId}-${i}`];
            if (seq && seq.length) labels.push(...seq);
        });
        return labels.length > 0 ? Array.from(new Set(labels)).join(',') : undefined;
    };

    const [clientReportQuote, setClientReportQuote] = useState<any | null>(null);
    const [clientReportLoading, setClientReportLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Report View Modal
    const [reportQuote, setReportQuote] = useState<any | null>(null);
    const [reportBends, setReportBends] = useState<any[]>([]);

    // ── Pre-existing state ──
    const [currentRisks, setCurrentRisks] = useState<Risk[]>([]);

    const [pendingDir, setPendingDir] = useState<RiskDirection | null>(null);
    const [pendingSize, setPendingSize] = useState('');
    const [sizeError, setSizeError] = useState('');

    // Angle State
    const [isAngle, setIsAngle] = useState(false);
    const [pendingAngle, setPendingAngle] = useState('');

    // Risk editing
    const [editSizeIdx, setEditSizeIdx] = useState<number | null>(null);
    const [editSizeVal, setEditSizeVal] = useState('');
    const [editDirIdx, setEditDirIdx] = useState<number | null>(null);
    const [editingAngleIdx, setEditingAngleIdx] = useState<number | null>(null);
    const [editAngleVal, setEditAngleVal] = useState('');

    // Preserved lengths when editing existing bend
    const [editingBendLengths, setEditingBendLengths] = useState<string[] | null>(null);

    // Otimização de Cortes
    const [isLateralSlope, setIsLateralSlope] = useState(false);
    const [slopeH1, setSlopeH1] = useState('');
    const [slopeH2, setSlopeH2] = useState('');


    // Otimização de Cortes
    const [optResult, setOptResult] = useState<{ bins: any[], pieceToSeq: Record<string, number[]> }>({ bins: [], pieceToSeq: {} });

    useEffect(() => {
        setOptResult(calculateOptimization(bends));
    }, [bends]);

    // Auto-scroll para a seção de totais ao entrar no resumo e atualizar settings
    useEffect(() => {
        if (step === 'summary') {
            // Re-busca settings ao entrar no resumo para garantir que os valores padrão estejam disponíveis (Item 1)
            fetch('/api/settings').then(r => r.json()).then(d => {
                setSettings(d);
                // Preenche os overrides se estiverem vazios para que não fiquem em branco na tela (Item 1)
                if ((!overridePricePerM2 || overridePricePerM2 === '') && d.pricePerM2) {
                    setOverridePricePerM2(String(d.pricePerM2));
                }
                if ((!overrideCostPerM2 || overrideCostPerM2 === '') && d.costPerM2) {
                    setOverrideCostPerM2(String(d.costPerM2));
                }
            }).catch(() => { });

            // Pequeno delay para o DOM renderizar antes do scroll
            const t = setTimeout(() => {
                summaryTotalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 180);
            return () => clearTimeout(t);
        }
    }, [step]);

    // Post-confirm
    // (removed)

    // Bend library — loaded from API filtered by product
    const [bendLibrary, setBendLibrary] = useState<SavedBend[]>([]);
    const [bendLibraryLoading, setBendLibraryLoading] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);

    // UI
    const [zoomImg, setZoomImg] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [savedQuote, setSavedQuote] = useState<any>(null);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);

    // Caída Lateral State
    const [slopeSide, setSlopeSide] = useState<'D' | 'E'>('D');

    // Editing Slope State
    const [editingSlopeIdx, setEditingSlopeIdx] = useState<number | null>(null);
    const [editSlopeH1, setEditSlopeH1] = useState('');
    const [editSlopeH2, setEditSlopeH2] = useState('');
    const [editSlopeSide, setEditSlopeSide] = useState<'D' | 'E'>('D');

    const svgRef = useRef<SVGSVGElement>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const metersRef = useRef<HTMLDivElement>(null);
    const serviceDescRef = useRef<HTMLTextAreaElement>(null);
    const sizeInputRef = useRef<HTMLInputElement>(null);
    const summaryTotalsRef = useRef<HTMLDivElement>(null);

    // Grouping UI State
    const [changingGroupId, setChangingGroupId] = useState<string | null>(null);
    const [tempGroupName, setTempGroupName] = useState('');
    // ── Agrupar por Cômodo ──────────────────────────────────────────────────
    const [groupByRoom, setGroupByRoom] = useState(false);
    const [currentGroupName, setCurrentGroupName] = useState('');
    const [lastGroupName, setLastGroupName] = useState('');

    // Inline service editing
    const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
    const [editServiceDesc, setEditServiceDesc] = useState('');
    const [editServiceVal, setEditServiceVal] = useState('');
    const [editServiceQtyStr, setEditServiceQtyStr] = useState('1');

    const handleResetQuote = () => {
        setBends([]);
        setCurrentRisks([]);
        setStep('bends');
        setEditingQuoteId(null);
        setSavedQuote(null);
        setNotes('');
        setClientName('');
        setClientSearch('');
        setSelectedClientId(null);
        setSelectedProductId(null);
        setSelectedProductName('');
        setOverridePricePerM2(settings.pricePerM2 || '');
        setOverrideCostPerM2(settings.costPerM2 || '');
        setDiscountAmount('');
        setGroupByRoom(false);
        setCurrentGroupName('');
        setLastGroupName('');
        // Focus client search after a short delay to allow re-render
        setTimeout(() => {
            const el = document.querySelector('input[placeholder*="Buscar ou digitar nome do cliente"]') as HTMLInputElement;
            el?.focus();
        }, 300);
    };

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/auth/check', { credentials: 'include' })
            .then(r => r.json())
            .then(d => {
                if (cancelled) return;
                if (!d.authenticated) {
                    localStorage.removeItem('user');
                    navigate('/login', { replace: true });
                } else {
                    setUser(d);
                    localStorage.setItem('user', JSON.stringify({
                        authenticated: true, role: d.role, name: d.name, id: d.id,
                    }));
                    fetch('/api/quotes', { credentials: 'include' })
                        .then(r => r.json()).then(setMyQuotes).catch(() => { });
                    // Load clients and products for autocomplete and selector
                    fetch('/api/clients', { credentials: 'include' })
                        .then(r => r.ok ? r.json() : []).then(setAllClients).catch(() => { });
                    fetch('/api/products', { credentials: 'include' })
                        .then(r => r.ok ? r.json() : []).then(setAllProducts).catch(() => { });
                }
            })
            .catch(() => {
                if (!cancelled) {
                    localStorage.removeItem('user');
                    navigate('/login', { replace: true });
                }
            });
        fetch('/api/settings').then(r => r.json()).then(d => {
            setSettings(d);
            if (d.pricePerM2) setOverridePricePerM2(d.pricePerM2);
            if (d.costPerM2) setOverrideCostPerM2(d.costPerM2);
        }).catch(() => { });
        fetch('/api/pix-keys').then(r => r.json()).then(setPixKeys).catch(() => { });
        return () => { cancelled = true; };
    }, []);

    // Fetch bend library filtered by selected product
    useEffect(() => {
        if (!selectedProductId) {
            setBendLibrary([]);
            setShowLibrary(false);
            return;
        }
        let cancelled = false;
        setBendLibraryLoading(true);
        fetch(`/api/bend-library?productId=${selectedProductId}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then((data: any[]) => {
                if (cancelled) return;
                // Normalize snake_case -> camelCase from API
                const normalized: SavedBend[] = (data || []).map(b => ({
                    id: b.id,
                    risks: b.risks || [],
                    roundedWidthCm: b.rounded_width_cm ?? b.roundedWidthCm ?? 0,
                    svgDataUrl: b.svg_data_url ?? b.svgDataUrl ?? '',
                    useCount: b.use_count ?? b.useCount ?? 1,
                    product_id: b.product_id,
                }));
                setBendLibrary(normalized);
            })
            .catch(() => { if (!cancelled) setBendLibrary([]); })
            .finally(() => { if (!cancelled) setBendLibraryLoading(false); });
        return () => { cancelled = true; };
    }, [selectedProductId]);

    const curWidth = sumRisks(currentRisks);
    const curRounded = roundToMultipleOf5(curWidth);
    const isOver = curWidth > MAX_W;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const isReversal = (dir: RiskDirection, size: number) => {
        if (!currentRisks.length) return false;
        const last = currentRisks[currentRisks.length - 1];
        return OPPOSITE_DIRECTION[dir] === last.direction && size === last.sizeCm;
    };

    const saveToBendLibrary = async (risks: Risk[], roundedWidthCm: number, svgDataUrl?: string) => {
        if (!selectedProductId) return;
        try {
            const res = await fetch('/api/bend-library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    productId: selectedProductId,
                    risks,
                    roundedWidthCm,
                    svgDataUrl
                }),
            });
            if (res.ok) {
                const raw = await res.json();
                // Normalize snake_case -> camelCase
                const updated: SavedBend = {
                    id: raw.id,
                    risks: raw.risks || risks,
                    roundedWidthCm: raw.rounded_width_cm ?? raw.roundedWidthCm ?? roundedWidthCm,
                    svgDataUrl: raw.svg_data_url ?? raw.svgDataUrl ?? svgDataUrl ?? '',
                    useCount: raw.use_count ?? raw.useCount ?? 1,
                    product_id: raw.product_id ?? selectedProductId,
                };
                setBendLibrary(prev => {
                    // Replace existing entry with same id, or prepend if new
                    const exists = prev.findIndex(b => b.id === updated.id);
                    if (exists >= 0) {
                        const next = [...prev];
                        next[exists] = updated;
                        return next;
                    }
                    return [updated, ...prev].slice(0, 50);
                });
            }
        } catch (err) {
            console.error('Error saving to bend library:', err);
        }
    };


    const selectDirection = (dir: RiskDirection) => {
        setPendingDir(dir);
        setTimeout(() => sizeInputRef.current?.focus(), 50);
    };

    const handleAddRisk = () => {
        let size = parseFloat(pendingSize);
        if (!pendingDir) { setSizeError('Selecione a direção'); return; }

        let riskSlope = undefined;
        if (isLateralSlope) {
            const h1 = parseFloat(slopeH1) || 0;
            const h2 = parseFloat(slopeH2) || 0;
            if (h1 <= 0 || h2 <= 0) { setSizeError('Informe as duas alturas da caída'); return; }
            size = Math.max(h1, h2);
            riskSlope = { side: slopeSide, h1, h2 };
        }

        if (!size || size <= 0) { setSizeError('Informe um tamanho válido'); return; }
        if (isReversal(pendingDir, size)) { setSizeError('⚠ Este risco anula o anterior e não é permitido.'); return; }
        if (curWidth + size > MAX_W) { setSizeError(`Excede ${MAX_W} cm. Disponível: ${(MAX_W - curWidth).toFixed(1)} cm`); return; }

        const angleNum = isAngle && pendingAngle ? parseFloat(pendingAngle) : null;
        if (isAngle && pendingAngle && (isNaN(angleNum!) || angleNum! < -180 || angleNum! > 180)) {
            setSizeError('Ângulo inválido. Deve ser entre -180 e 180.'); return;
        }

        setSizeError('');
        setCurrentRisks(prev => [...prev, {
            direction: pendingDir,
            sizeCm: size,
            slopeData: riskSlope,
            angle: angleNum
        }]);
        setPendingDir(null);
        setPendingSize('');
        // Also clear slope state after adding
        setIsLateralSlope(false);
        setSlopeH1('');
        setSlopeH2('');
        setIsAngle(false);
        setPendingAngle('');
    };

    const ignoreSizeBlurRef = useRef(false);

    const commitEditSize = (idx: number) => {
        if (ignoreSizeBlurRef.current) return;
        const size = parseFloat(editSizeVal);
        if (!size || size <= 0) { setEditSizeIdx(null); return; }

        setCurrentRisks(prev => {
            const next = [...prev];
            // If the risk was just converted to a slope instantly by onMouseDown, skip size update
            if (next[idx]?.slopeData) return prev;
            next[idx] = { ...next[idx], sizeCm: size };
            if (sumRisks(next) > MAX_W) { setSizeError(`Edição excede ${MAX_W} cm`); return prev; }
            return next;
        });
        setEditSizeIdx(null);
        setSizeError('');
    };

    const commitEditDir = (idx: number, dir: RiskDirection) => {
        const next = [...currentRisks];
        next[idx] = { ...next[idx], direction: dir };
        setCurrentRisks(next);
        setEditDirIdx(null);
    };

    const commitEditSlope = (idx: number, remove = false) => {
        if (remove) {
            setCurrentRisks(prev => {
                const next = [...prev];
                next[idx] = { ...next[idx], slopeData: undefined };
                return next;
            });
            setEditingSlopeIdx(null);
            setEditSlopeSide('D');
            setEditSlopeH1('');
            setEditSlopeH2('');
            return;
        }
        const h1 = parseFloat(editSlopeH1);
        const h2 = parseFloat(editSlopeH2);
        if (isNaN(h1) || isNaN(h2) || h1 <= 0 || h2 <= 0) { setEditingSlopeIdx(null); return; }

        const size = Math.max(h1, h2);
        const next = [...currentRisks];
        next[idx] = {
            ...next[idx],
            sizeCm: size,
            slopeData: { h1, h2, side: editSlopeSide }
        };

        const total = sumRisks(next);
        if (total > MAX_W) { setSizeError(`Edição excede ${MAX_W} cm`); setEditingSlopeIdx(null); return; }

        setCurrentRisks(next);
        setEditingSlopeIdx(null);
        setSizeError('');
    };

    const commitEditAngle = (idx: number) => {
        const val = parseFloat(editAngleVal);
        const next = [...currentRisks];
        if (isNaN(val)) {
            next[idx] = { ...next[idx], angle: null };
        } else {
            next[idx] = { ...next[idx], angle: val };
        }
        setCurrentRisks(next);
        setEditingAngleIdx(null);
    };

    const handleConfirmBend = async () => {
        if (!selectedProductId) {
            setToast({ msg: '⚠ Selecione o produto (tipo de calha) antes de adicionar dobras.', type: 'error' });
            return;
        }
        if (!currentRisks.length) { setToast({ msg: 'Adicione pelo menos 1 risco', type: 'error' }); return; }
        if (isOver) { setToast({ msg: 'Largura excede 1,20m!', type: 'error' }); return; }
        let svgDataUrl = '';
        if (svgRef.current) svgDataUrl = await captureSvg(svgRef.current);
        const savedLengths = editingBendLengths && editingBendLengths.some(l => parseFloat(l) > 0) ? editingBendLengths : [''];

        const bendCount = bends.filter(b => b.productType === 'product' || !b.productType).length;

        // Requirement 3: Enforce room input if groupByRoom is active
        const finalGroupName = (currentGroupName || '').trim() || (lastGroupName || '').trim();
        if (groupByRoom && !finalGroupName) {
            setToast({ msg: '⚠ Informe o CÔMODO para agrupar esta dobra.', type: 'error' });
            return;
        }

        const newBend: Bend = {
            id: uid(),
            risks: [...currentRisks],
            totalWidthCm: curWidth,
            roundedWidthCm: curRounded,
            lengths: savedLengths,
            totalLengthM: 0,
            m2: 0,
            svgDataUrl,
            product_id: selectedProductId || undefined,
            productType: 'product',
            group_name: groupByRoom ? finalGroupName : ''
        };
        // Recalc m2 if lengths were preserved
        if (savedLengths !== null && savedLengths.some(l => parseFloat(l) > 0)) {
            const calc = calcM2(curRounded, savedLengths);
            newBend.totalLengthM = calc.totalLengthM;
            newBend.m2 = calc.m2;
        }
        setBends(prev => [...prev, newBend]);
        saveToBendLibrary([...currentRisks], curRounded, svgDataUrl);
        // Save last used group
        if (groupByRoom && currentGroupName.trim()) setLastGroupName(currentGroupName.trim());
        setCurrentRisks([]);
        setPendingDir(null);
        setPendingSize('');
        setIsLateralSlope(false);
        setSlopeH1('');
        setSlopeH2('');
        setIsAngle(false);
        setPendingAngle('');
        setEditingBendLengths(null);
        setShowLibrary(false);
        // Recalc optimization
        setOptResult(calculateOptimization([...bends, newBend]));
        setTimeout(() => {
            metersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => document.getElementById(`cut-input-${newBend.id}-0`)?.focus(), 100);
        }, 150);
    };

    const updateLength = (bendId: string, idx: number, val: string) => {
        setBends(prev => prev.map(b => {
            if (b.id !== bendId) return b;
            const ls = [...b.lengths]; ls[idx] = val;
            return { ...b, lengths: ls, ...calcM2(b.roundedWidthCm, ls) };
        }));
    };

    const handleSubmit = async () => {
        if (!bends.length) {
            setToast({ msg: 'Adicione pelo menos um item (dobra ou serviço)', type: 'error' });
            return;
        }

        const hasLengths = bends.every(b => b.productType === 'service' || b.lengths.some(l => parseFloat(l) > 0));
        if (!hasLengths) {
            setToast({ msg: 'Informe os cortes (metros corridos) em todas as dobras', type: 'error' });
            return;
        }

        await performSubmit(bends);
    };

    const performSubmit = async (currentBends: Bend[]) => {
        setSubmitting(true);
        try {
            const url = editingQuoteId ? `/api/quotes/${editingQuoteId}` : '/api/quotes';
            const method = editingQuoteId ? 'PUT' : 'POST';

            if (!isOnline) {
                // MODO OFFLINE: Salva no IndexedDB
                const estimateData = {
                    clientName: clientName || user?.name || user?.username,
                    clientId: selectedClientId || undefined,
                    productId: selectedProductId || undefined,
                    type_product: selectedProductType,
                    pricePerM2Override: overridePricePerM2 || undefined,
                    costPerM2Override: overrideCostPerM2 || undefined,
                    discount_amount: parseFloat(discountAmount) || 0,
                    isGrouped: groupByRoom,
                    notes,
                    bends: currentBends.map(b => ({
                        productType: b.productType || 'product',
                        serviceDescription: b.serviceDescription,
                        serviceValue: b.serviceValue,
                        serviceQty: b.serviceQty,
                        group_name: b.group_name,
                        risks: b.risks,
                        totalWidthCm: b.totalWidthCm,
                        roundedWidthCm: b.roundedWidthCm,
                        lengths: b.lengths.filter(l => parseFloat(l) > 0).map(Number),
                        totalLengthM: b.totalLengthM,
                        m2: b.m2,
                        svgDataUrl: b.svgDataUrl,
                        product_id: b.product_id || selectedProductId || undefined,
                    })),
                    totalValue,
                    finalValue: finalWithDiscount,
                };

                await saveOffline(estimateData, user?.company_id);
                setToast({ msg: 'Modo Offline: Orçamento salvo localmente e será sincronizado ao conectar!', type: 'success' });
                setStep('bends');
                handleResetQuote();
                return;
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    clientName: clientName || user?.name || user?.username,
                    clientId: selectedClientId || undefined,
                    productId: selectedProductId || undefined,
                    type_product: selectedProductType,
                    pricePerM2Override: overridePricePerM2 || undefined,
                    costPerM2Override: overrideCostPerM2 || undefined,
                    discount_amount: parseFloat(discountAmount) || 0,
                    isGrouped: groupByRoom,
                    notes,
                    bends: currentBends.map(b => ({
                        productType: b.productType || 'product',
                        serviceDescription: b.serviceDescription,
                        serviceValue: b.serviceValue,
                        serviceQty: b.serviceQty,
                        group_name: b.group_name,
                        risks: b.risks,
                        totalWidthCm: b.totalWidthCm,
                        roundedWidthCm: b.roundedWidthCm,
                        lengths: b.lengths.filter(l => parseFloat(l) > 0).map(Number),
                        totalLengthM: b.totalLengthM,
                        m2: b.m2,
                        svgDataUrl: b.svgDataUrl,
                        product_id: b.product_id || selectedProductId || undefined,
                    })),
                }),
            });
            if (!res.ok) {
                const ct = res.headers.get('content-type') || '';
                const errMsg = ct.includes('json') ? (await res.json()).error : await res.text();
                throw new Error(errMsg || `HTTP ${res.status}`);
            }
            const quote = await res.json();
            setSavedQuote(quote);
            setEditingQuoteId(quote.id);
            setStep('payment');
            setToast({ msg: editingQuoteId ? 'Orçamento atualizado!' : 'Orçamento salvo!', type: 'success' });
            fetch('/api/quotes', { credentials: 'include' }).then(r => r.json()).then(setMyQuotes).catch(() => { });
        } catch (err: any) {
            setToast({ msg: `Erro: ${err.message}`, type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!bends.length) { setToast({ msg: 'Adicione pelo menos uma dobra', type: 'error' }); return; }
        setSavingDraft(true);
        try {
            if (!isOnline) {
                const estimateData = {
                    clientName: clientName || user?.name || user?.username,
                    clientId: selectedClientId || undefined,
                    productId: selectedProductId || undefined,
                    type_product: selectedProductType,
                    pricePerM2Override: overridePricePerM2 || undefined,
                    costPerM2Override: overrideCostPerM2 || undefined,
                    discount_amount: parseFloat(discountAmount) || 0,
                    isGrouped: groupByRoom,
                    notes,
                    bends: bends.map(b => ({
                        productType: b.productType || 'product',
                        serviceDescription: b.serviceDescription,
                        serviceValue: b.serviceValue,
                        serviceQty: b.serviceQty,
                        group_name: b.group_name,
                        risks: b.risks,
                        totalWidthCm: b.totalWidthCm,
                        roundedWidthCm: b.roundedWidthCm,
                        lengths: b.lengths.filter(l => parseFloat(l) > 0).map(Number),
                        totalLengthM: b.totalLengthM,
                        m2: b.m2,
                        svgDataUrl: b.svgDataUrl,
                        product_id: b.product_id || selectedProductId || undefined,
                    })),
                    totalValue,
                    finalValue: finalWithDiscount,
                    status: 'draft'
                };
                await saveOffline(estimateData, user?.company_id);
                setToast({ msg: 'Rascunho salvo offline!', type: 'success' });
                return;
            }

            const url = editingQuoteId ? `/api/quotes/${editingQuoteId}` : '/api/quotes';
            const method = editingQuoteId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    clientName: clientName || user?.name || user?.username,
                    clientId: selectedClientId || undefined,
                    productId: selectedProductId || undefined,
                    discount_amount: parseFloat(discountAmount) || 0,
                    isGrouped: groupByRoom,
                    notes,
                    status: 'rascunho',
                    bends: bends.map(b => ({
                        productType: b.productType || 'product',
                        serviceDescription: b.serviceDescription,
                        serviceValue: b.serviceValue,
                        serviceQty: b.serviceQty,
                        group_name: b.group_name,
                        risks: (b as any).risks,
                        totalWidthCm: (b as any).totalWidthCm,
                        roundedWidthCm: (b as any).roundedWidthCm,
                        lengths: b.lengths.filter(l => parseFloat(l) > 0).map(Number),
                        totalLengthM: b.totalLengthM,
                        m2: b.m2,
                        svgDataUrl: b.svgDataUrl,
                        product_id: (b as any).product_id || selectedProductId || undefined,
                    })),
                }),
            });
            if (res.ok) {
                const quote = await res.json();
                setEditingQuoteId(quote.id);
                setSavedQuote(quote);
                setToast({ msg: editingQuoteId ? 'Rascunho atualizado!' : 'Rascunho salvo! Continue depois.', type: 'success' });
                fetch('/api/quotes', { credentials: 'include' }).then(r => r.json()).then(setMyQuotes).catch(() => { });
            } else setToast({ msg: 'Erro ao salvar rascunho', type: 'error' });
        } catch { setToast({ msg: 'Erro ao salvar rascunho', type: 'error' }); }
        finally { setSavingDraft(false); }
    };

    const handleCancelQuote = async (id: string | number) => {
        if (!confirm('Tem certeza que deseja cancelar este orçamento?')) return;
        console.log(`[DEBUG_FRONT] Cancelling quote: ${id}`);
        try {
            const res = await fetch(`/api/quotes/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: 'cancelled' })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Erro ${res.status}`);
            }
            setMyQuotes(prev => prev.map(q => (q.id === id || q._id === id) ? { ...q, status: 'cancelled' } : q));
            setToast({ msg: 'Orçamento cancelado', type: 'success' });
        } catch (err: any) {
            console.error('[CANCEL_ERROR]', err);
            setToast({ msg: `Erro ao cancelar: ${err.message}`, type: 'error' });
        }
    };

    const handleConfirmService = () => {
        if (!selectedProductId) {
            setToast({ msg: 'Selecione um produto/serviço', type: 'error' });
            return;
        }
        const val = parseFloat(serviceValue) || 0;
        if (val <= 0) {
            setToast({ msg: 'Informe o valor do serviço', type: 'error' });
            return;
        }
        const qty = parseFloat(serviceQty) || 1;

        const serviceCount = bends.filter(b => b.productType === 'service').length;
        const newService: Bend = {
            id: uid(),
            productType: 'service',
            serviceDescription,
            serviceValue: val,
            serviceQty: qty,
            risks: [],
            totalWidthCm: 0,
            roundedWidthCm: 0,
            lengths: [],
            totalLengthM: 0,
            m2: 0,
            group_name: '' // Disregard grouping for services
        };

        setBends(prev => [...prev, newService]);
        setToast({ msg: 'Serviço adicionado!', type: 'success' });
        // Reset service fields
        setServiceDescription('');
        setServiceValue('');
        setServiceQty('1');
    };

    const handleEditQuote = async (q: any) => {
        const id = q.id || q._id;
        if (!id) { setToast({ msg: 'ID do orçamento inválido', type: 'error' }); return; }

        console.log(`[DEBUG_FRONT] Editing quote ID: ${id}`);
        setLoadingQuoteId(id);
        setToast({ msg: 'Carregando dados...', type: 'success' });

        try {
            const res = await fetch(`/api/quotes/${id}/bends`, { credentials: 'include' });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Erro ${res.status}`);
            }

            const loadedBends = await res.json();
            if (!Array.isArray(loadedBends)) throw new Error('Formato de dados inválido');

            const mapped: Bend[] = loadedBends.map((b: any) => {
                if (b.productType === 'service') {
                    return {
                        id: b.id || uid(),
                        productType: 'service' as const,
                        serviceDescription: b.serviceDescription || '',
                        serviceValue: b.serviceValue || 0,
                        serviceQty: b.serviceQty || 1,
                        product_id: b.product_id,
                        group_name: b.group_name,
                        risks: [],
                        totalWidthCm: 0,
                        roundedWidthCm: 0,
                        lengths: [],
                        totalLengthM: 0,
                        m2: 0,
                    };
                }
                return {
                    id: b.id || uid(),
                    group_id: b.group_id,
                    group_name: b.group_name,
                    productType: (b.productType || 'product') as 'product' | 'service',
                    risks: (Array.isArray(b.risks) ? b.risks : []).map((r: any) => ({
                        ...r,
                        slopeData: r.slope_data || r.slopeData || null
                    })),
                    totalWidthCm: b.totalWidthCm || 0,
                    roundedWidthCm: b.roundedWidthCm || 0,
                    lengths: Array.isArray(b.lengths) ? b.lengths.map(String) : [''],
                    totalLengthM: b.totalLengthM || 0,
                    m2: b.m2 || 0,
                    svgDataUrl: b.svgDataUrl || '',
                    product_id: b.product_id,
                };
            });

            // Clean up double prefixes in notes if they survived server mapping
            let cleanNotes = q.notes || '';
            while (cleanNotes.startsWith('[CLIENT: ')) {
                const m = cleanNotes.match(/\[CLIENT: (.*?)\]\s?(.*)/);
                if (m) cleanNotes = m[2]; else break;
            }

            setBends(mapped);
            setClientName(q.clientName || '');
            setSelectedClientId(q.client_id || q.clientId || null);
            setClientSearch(q.clientName || '');
            setNotes(cleanNotes);
            setOverridePricePerM2(q.price_per_m2 || settings.pricePerM2 || '');
            setOverrideCostPerM2(q.cost_per_m2 || settings.costPerM2 || '');
            setDiscountAmount(String(q.discount_amount || ''));
            setGroupByRoom(!!(q.is_grouped));
            setEditingQuoteId(id);
            setShowMyQuotes(false);
            setStep('bends');
            setToast({ msg: `Editando orçamento #${String(id).substring(0, 8)}`, type: 'success' });
        } catch (err: any) {
            console.error('[EDIT_ERROR]', err);
            setToast({ msg: `Erro ao carregar dobras: ${err.message}`, type: 'error' });
        } finally {
            setLoadingQuoteId(null);
        }
    };

    const handleViewReport = async (q: any) => {
        const id = q.id || q._id;
        if (!id) return;

        console.log(`[DEBUG_FRONT] Viewing report for ID: ${id}`);
        setLoadingQuoteId(id);
        try {
            const res = await fetch(`/api/quotes/${id}/bends`, { credentials: 'include' });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Falha ao buscar dobras');
            }
            const loadedBends = await res.json();
            const mapped = (loadedBends || []).map((b: any) => ({
                ...b,
                risks: (b.risks || []).map((r: any) => ({
                    ...r,
                    slopeData: r.slope_data || r.slopeData || null
                }))
            }));
            setReportBends(mapped);
            setReportQuote(q);
        } catch (err: any) {
            console.error('[REPORT_ERROR]', err);
            setToast({ msg: err.message || 'Erro ao carregar relatório', type: 'error' });
        } finally {
            setLoadingQuoteId(null);
        }
    };

    const handleViewClientReport = async (q: any, manualBends?: Bend[]) => {
        const id = q.id || q._id;
        setClientReportLoading(true);
        try {
            let data: any;
            if (id && id !== 'PREVIA') {
                const res = await fetch(`/api/quotes/${id}`, { credentials: 'include' });
                if (!res.ok) throw new Error('Erro ao buscar dados do orçamento');
                data = await res.json();
            } else {
                // Mock data for preview
                data = {
                    ...q,
                    created_at: new Date().toISOString(),
                    total_amount: totalValue,
                    final_amount: totalValue,
                    discount_amount: 0,
                    notes: notes,
                    items: (manualBends || bends).map(b => {
                        const isService = b.productType === 'service';
                        const overrideVal = parseFloat(overridePricePerM2);
                        const currentBasePrice = isNaN(overrideVal) ? parseFloat(settings.pricePerM2 || '50') : overrideVal;
                        const uPrice = isService ? (b.serviceValue || 0) : currentBasePrice;
                        const tPrice = isService ? (uPrice * (b.serviceQty || 1)) : (b.m2 * currentBasePrice);
                        return {
                            product_id: b.product_id,
                            description: isService ? `[SERVICE] ${b.serviceDescription}` : `[BEND] ${JSON.stringify(b)}`,
                            quantity: isService ? (b.serviceQty || 1) : (b.m2 || 1),
                            unit_price: uPrice,
                            total_price: tPrice,
                            product: allProducts.find(p => p.id === b.product_id)
                        };
                    })
                };
            }

            // Agrupamento inteligente por product_id e sub-agrupamento por preço caso o mesmo produto tenha preços diferentes
            const groupedMap: Record<string, any> = {};

            (data.items || []).forEach((item: any) => {
                const desc: string = item.description || '';
                const p = item.product || {};
                const name = p.name || (desc.startsWith('[SERVICE]') ? desc.replace('[SERVICE] ', '') : 'Fabricação de Calha/Rufo');
                const unit = p.unit || (desc.startsWith('[BEND]') ? 'm²' : 'un');
                const key = `${item.product_id || 'manual'}-${name}-${item.unit_price}`;

                if (!groupedMap[key]) {
                    groupedMap[key] = {
                        name,
                        unit,
                        unit_price: item.unit_price,
                        quantity: 0,
                        total_price: 0,
                        type: p.type_product || (desc.startsWith('[SERVICE]') ? 'service' : 'product')
                    };
                }

                // Para dobras, quantity no item é 1, mas o que importa para o cliente é o total.
                // Se for dobra, vamos mostrar m2 como quantidade se o produto for cobrado por m2.
                if (desc.startsWith('[BEND]')) {
                    try {
                        const bendData = JSON.parse(desc.substring(7));
                        groupedMap[key].quantity += (bendData.m2 || 0);
                    } catch {
                        groupedMap[key].quantity += (parseFloat(item.quantity) || 0);
                    }
                } else {
                    groupedMap[key].quantity += (parseFloat(item.quantity) || 0);
                }
                groupedMap[key].total_price += (parseFloat(item.total_price) || 0);
            });

            const aggregatedItems = Object.values(groupedMap).sort((a: any, b: any) => a.name.localeCompare(b.name));

            const totalAmt = parseFloat(data.total_amount || data.totalValue || 0);
            const discountAmt = parseFloat(data.discount_amount || data.discountValue || 0);
            const finalAmt = parseFloat(data.final_amount || data.finalValue || 0) || (totalAmt - discountAmt);
            const quoteNum = String(data.id || '').substring(0, 8).toUpperCase();
            const emissionDate = new Date(data.created_at || new Date()).toLocaleDateString('pt-BR');
            const validityDays = parseInt(settings.reportValidityDays || '7');
            const validityDate = new Date(data.created_at || new Date());
            validityDate.setDate(validityDate.getDate() + validityDays);
            const validityStr = validityDate.toLocaleDateString('pt-BR');
            const [clientRawName, ...clientExtras] = (data.clientName || 'Consumidor Final').split('|');
            const clientName = clientRawName.trim();

            const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orçamento #${quoteNum} — ${clientName}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet">
<style>
:root{--brand:#1a56db;--brand-dark:#1e3a8a;--brand-mid:#2563eb;--brand-soft:#eff6ff;--accent:#0ea5e9;--green:#16a34a;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--bg:#f8fafc;--white:#ffffff}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px}
body{font-family:'Inter',system-ui,sans-serif;color:var(--text);background:var(--bg);-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{body{background:white}.no-print{display:none!important}.page{margin:0!important;box-shadow:none!important;border-radius:0!important;max-width:100%!important;padding:28px!important}.total-block{box-shadow:none!important}}
.print-btn{position:fixed;bottom:28px;right:28px;background:var(--brand);color:#fff;border:none;padding:14px 28px;border-radius:999px;font-family:'Inter',sans-serif;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(26,86,219,.4);transition:transform .15s,box-shadow .15s;z-index:999}
.print-btn:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(26,86,219,.5)}
.page{max-width:860px;margin:36px auto;background:var(--white);border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,.07),0 20px 40px -8px rgba(0,0,0,.08);overflow:hidden}
.accent-bar{height:6px;background:linear-gradient(90deg,var(--brand-dark) 0%,var(--brand-mid) 50%,var(--accent) 100%)}
.inner{padding:40px 48px}
.doc-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:28px;border-bottom:2px solid var(--border);margin-bottom:28px;gap:24px}
.logo-area{display:flex;align-items:flex-start;gap:20px}
.logo-area img{height:64px;width:auto;object-fit:contain;border-radius:8px}
.logo-placeholder{width:64px;height:64px;border-radius:8px;background:linear-gradient(135deg,var(--brand-soft),#dbeafe);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.logo-placeholder svg{width:28px;height:28px;stroke:var(--brand);fill:none}
.company-block h1{font-size:20px;font-weight:800;color:var(--brand-dark);letter-spacing:-.02em;text-transform:uppercase;line-height:1.2;margin-bottom:6px}
.company-block .meta{font-size:12px;color:var(--muted);line-height:1.9}
.company-block .meta span{margin-right:16px;white-space:nowrap}
.doc-id-block{text-align:right;flex-shrink:0}
.doc-badge{display:inline-block;background:var(--brand-dark);color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;padding:5px 12px;border-radius:6px;margin-bottom:8px}
.doc-number{font-size:26px;font-weight:900;color:var(--brand);letter-spacing:-.03em;line-height:1}
.doc-meta{margin-top:8px;font-size:11.5px;color:var(--muted);line-height:1.8}
.doc-meta strong{color:var(--text);font-weight:600}
.client-card{background:var(--brand-soft);border:1px solid #bfdbfe;border-radius:12px;padding:18px 24px;margin-bottom:28px;display:grid;grid-template-columns:auto 1fr;gap:0 20px;align-items:start}
.client-card .cc-icon{width:42px;height:42px;border-radius:10px;background:var(--brand);display:flex;align-items:center;justify-content:center;flex-shrink:0;align-self:center}
.client-card .cc-icon svg{width:20px;height:20px;stroke:#fff;fill:none}
.client-card .cc-label{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--brand-mid);margin-bottom:4px}
.client-card .cc-name{font-size:17px;font-weight:800;color:var(--text);line-height:1.2;margin-bottom:3px}
.client-card .cc-sub{font-size:12px;color:var(--muted)}
.section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--brand);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.section-title::after{content:'';flex:1;height:1px;background:var(--border)}
.items-table{width:100%;border-collapse:collapse;margin-bottom:32px}
.items-table thead tr{background:var(--brand-dark)}
.items-table thead th{padding:12px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.9);white-space:nowrap}
.items-table thead th:not(:first-child){text-align:right}
.items-table thead th:first-child{border-radius:8px 0 0 8px}
.items-table thead th:last-child{border-radius:0 8px 8px 0}
.items-table tbody tr:nth-child(even) td{background:#f9fafb}
.items-table tbody tr:last-child td{border-bottom:none}
.items-table tbody td{padding:14px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
.items-table tbody td:not(:first-child){text-align:right}
.item-name{font-weight:600;font-size:13.5px;color:var(--text);display:block}
.item-badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:4px}
.badge-product{background:#dcfce7;color:#15803d}
.badge-service{background:#f3e8ff;color:#7e22ce}
.qty-val{font-weight:600;font-size:13px}
.qty-unit{font-size:11px;color:var(--muted);font-weight:400;margin-left:2px}
.price-unit{font-size:13px;color:var(--muted)}
.price-total{font-size:14px;font-weight:700;color:var(--text)}
.bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
.conditions-block{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:20px 22px}
.cond-row{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px}
.cond-row:last-child{border-bottom:none}
.cond-label{color:var(--muted);font-weight:500}
.cond-val{font-weight:700;color:var(--text);text-align:right;max-width:55%}
.total-block{background:linear-gradient(135deg,var(--brand-dark) 0%,var(--brand-mid) 100%);border-radius:12px;padding:24px;color:#fff;box-shadow:0 8px 24px rgba(26,86,219,.3)}
.total-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.12);font-size:13px}
.total-row:last-child{border-bottom:none;padding-top:16px;margin-top:6px}
.total-row .tl{color:rgba(255,255,255,.7);font-weight:500}
.total-row .tv{font-weight:700;font-size:14px}
.total-row.grand .tl{font-size:14px;font-weight:700;color:#fff}
.total-row.grand .tv{font-size:28px;font-weight:900;color:#4ade80;letter-spacing:-.02em;line-height:1}
.total-row.discount .tv{color:#fca5a5}
.notes-block{background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 18px;margin-bottom:28px}
.notes-block .notes-label{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#92400e;margin-bottom:5px}
.notes-block .notes-text{font-size:12.5px;color:#78350f;line-height:1.6;white-space:pre-wrap}
.doc-footer{border-top:1.5px solid var(--border);padding-top:24px;margin-top:8px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px}
.footer-left .footer-text{font-size:12px;color:var(--muted);font-style:italic;line-height:1.5;max-width:340px}
.footer-left .company-sig{font-size:13px;font-weight:800;color:var(--brand-dark);margin-top:6px}
.sig-area{text-align:center}
.sig-line{width:180px;border-bottom:1.5px solid #94a3b8;margin-bottom:6px}
.sig-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
  Imprimir / Salvar PDF
</button>
<div class="page">
  <div class="accent-bar"></div>
  <div class="inner">
    <header class="doc-header">
      <div class="logo-area">
        ${settings.reportLogo ? '<img src="' + settings.reportLogo + '" alt="Logo">' : '<div class="logo-placeholder"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>'}
        <div class="company-block">
          <h1>${settings.reportCompanyName || 'Empresa'}</h1>
          <div class="meta">
            ${settings.reportPhone ? '<span>📞 ' + settings.reportPhone + '</span>' : ''}
            ${settings.reportEmail ? '<span>✉ ' + settings.reportEmail + '</span>' : ''}
            ${settings.reportAddress ? '<span>📍 ' + settings.reportAddress + '</span>' : ''}
            ${settings.reportHeaderText ? '<span>' + settings.reportHeaderText + '</span>' : ''}
          </div>
        </div>
      </div>
      <div class="doc-id-block">
        <div class="doc-badge">Orçamento</div>
        <div class="doc-number">#${quoteNum}</div>
        <div class="doc-meta">
          <strong>Emissão:</strong> ${emissionDate}<br>
          <strong>Válido até:</strong> ${validityStr}
        </div>
      </div>
    </header>
    <div class="client-card">
      <div class="cc-icon">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div>
        <div class="cc-label">Cliente</div>
        <div class="cc-name">${clientName}</div>
        ${clientExtras.length > 0 ? '<div class="cc-sub">' + clientExtras.join(' | ').trim() + '</div>' : ''}
      </div>
    </div>
    <div class="section-title">Itens do Orçamento</div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:46%">Produto / Serviço</th>
          <th style="width:15%">Quantidade</th>
          <th style="width:20%">Valor Unit.</th>
          <th style="width:19%">Valor Total</th>
        </tr>
      </thead>
      <tbody>
        ${aggregatedItems.map((item: any) => {
                const isSvc = item.type === 'service';
                const qty = isSvc ? (item.quantity || 1) : (item.quantity || 0);
                const qtyFmt = isSvc ? qty.toString() : qty.toFixed(2);
                const unitStr = item.unit || (isSvc ? 'un' : 'm²');
                const uPrice = item.unit_price > 0 ? 'R$ ' + Number(item.unit_price).toFixed(2) : '—';
                return '<tr>' +
                    '<td>' +
                    '<span class="item-name">' + item.name + '</span>' +
                    '<span class="item-badge ' + (isSvc ? "badge-service" : "badge-product") + '">' + (isSvc ? "Serviço / Mão de obra" : "Material") + '</span>' +
                    '</td>' +
                    '<td><span class="qty-val">' + qtyFmt + '</span><span class="qty-unit">' + unitStr + '</span></td>' +
                    '<td><span class="price-unit">' + uPrice + '</span></td>' +
                    '<td><span class="price-total">R$ ' + (Number(item.total_price) || 0).toFixed(2) + '</span></td>' +
                    '</tr>';
            }).join('')}
      </tbody>
    </table>
    ${(data.notes || '') ? '<div class="notes-block"><div class="notes-label">📋 Observações</div><div class="notes-text">' + (data.notes || '').replace(/\[CLIENT:.*?\]/g, '').trim() + '</div></div>' : ''}
    <div class="bottom-grid">
      <div class="conditions-block">
        <div class="section-title" style="margin-bottom:14px">Condições Comerciais</div>
        ${settings.reportPaymentTerms ? '<div class="cond-row"><span class="cond-label">Forma de pagamento</span><span class="cond-val">' + settings.reportPaymentTerms + '</span></div>' : ''}
        ${settings.reportExecDays ? '<div class="cond-row"><span class="cond-label">Prazo de execução</span><span class="cond-val">' + settings.reportExecDays + ' dias úteis</span></div>' : ''}
        <div class="cond-row"><span class="cond-label">Validade do orçamento</span><span class="cond-val">${validityDays} dias (até ${validityStr})</span></div>
      </div>
      <div class="total-block">
        <div class="total-row"><span class="tl">Subtotal</span><span class="tv">R\$ ${totalAmt.toFixed(2)}</span></div>
        ${discountAmt > 0 ? '<div class="total-row discount"><span class="tl">Desconto</span><span class="tv">− R$ ' + discountAmt.toFixed(2) + '</span></div>' : ''}
        <div class="total-row grand"><span class="tl">TOTAL GERAL</span><span class="tv">R\$ ${finalAmt.toFixed(2)}</span></div>
      </div>
    </div>
    <footer class="doc-footer">
      <div class="footer-left">
        <p class="footer-text">"${settings.reportFooterText || 'Qualidade e compromisso com a proteção da sua estrutura.'}"</p>
        <p class="company-sig">${settings.reportCompanyName || ''}</p>
      </div>
      <div class="sig-area">
        <div class="sig-line"></div>
        <div class="sig-label">Assinatura do Cliente</div>
      </div>
    </footer>
  </div>
</div>
<script>window.onload=function(){document.querySelectorAll('img').forEach(function(i){var s=i.src;i.src='';i.src=s;});}</script>
</body>
</html>`;

            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html);
                win.document.close();
            }
        } catch (err: any) {
            setToast({ msg: err.message, type: 'error' });
        } finally {
            setClientReportLoading(false);
        }
    };

    const handleDownloadQuoteCompactPDF = (q: any, qBends: any[], existingWindow?: Window | null) => {
        const pm2 = parseFloat(settings.pricePerM2 || '50');
        const cm2 = parseFloat(settings.costPerM2 || '0');

        // Compact PDF usually used for production/construction, so filter out services if requested
        // but here we just follow the user "exclude services and include cost"
        const filteredBends = qBends.filter(b => b.productType !== 'service');

        const isGroupedQuote = q && typeof q.is_grouped === 'boolean' ? q.is_grouped : groupByRoom;

        const grouped = filteredBends.reduce((acc, b) => {
            const key = isGroupedQuote ? (b.group_name || 'Sem Grupo') : 'Sem Grupo';
            if (!acc[key]) acc[key] = [];
            acc[key].push(b);
            return acc;
        }, {} as Record<string, any[]>);


        const imgRows = (() => {
            return Object.entries(grouped).map(([gName, gBendsValue]) => {
                const gBends = gBendsValue as any[];

                // Só exibe o título do grupo se não for "Sem Grupo" e isGroupedQuote for true
                const groupTitleHtml = (isGroupedQuote && gName !== 'Sem Grupo') ? `<h3 class="group-title">🏠 ${gName}</h3>` : '';

                const bRows = gBends.map((b: any) => {
                    const i = qBends.findIndex(x => x === b);
                    const pCount = qBends.filter((item, idx) => idx < i && item.productType !== 'service').length + 1;
                    const cuts = Array.isArray(b.lengths) ? b.lengths.filter((l: any) => parseFloat(l) > 0) : [];
                    const cutsColumn = cuts.length > 0 ? `
                        <div class="cuts-side">${cuts.map((c: any) => `<div class="cut-line">${parseFloat(c).toFixed(2)}m</div>`).join('')}<div class="cut-divider"></div><div class="cut-total">${(b.totalLengthM || 0).toFixed(2)}m</div></div>` : '';
                    let svgEl = '';
                    if (b.svgDataUrl) svgEl = `<img src="${b.svgDataUrl}" class="compact-img"/>`;
                    else if (b.risks && b.risks.length > 0) { const fs = renderToString(<BendCanvas risks={b.risks} maxWidthCm={120} exportMode={true} />); svgEl = `<div class="compact-img-container">${fs}</div>`; }
                    const w = b.roundedWidthCm || 0;
                    return `<div class="bend-layout"><p class="bend-title">Dobra #${pCount} — ${(w / 100).toFixed(2)}m larg.</p><div class="bend-body"><div class="bend-drawing">${svgEl}</div>${cutsColumn}</div></div>`;
                }).join('');
                return groupTitleHtml + `<div class="bends-container">${bRows}</div>`;
            }).join('');
        })();

        const tM2 = filteredBends.reduce((acc: number, b: any) => acc + (b.m2 || 0), 0);
        const tVal = tM2 * pm2;
        const totalCostVal = tM2 * cm2;

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório Compacto - #${q.id}</title><style>
body{font-family:Arial,sans-serif;padding:10px;color:#000;max-width:210mm;margin:auto;font-size:10px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
h1{font-size:15px;margin:0 0 4px 0}
.group-title{font-size:13px;font-weight:bold;margin:14px 0 6px;padding:4px 0 4px 8px;border-left:4px solid #000;background:#f5f5f5;}
.bends-container{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;-webkit-column-count:unset;}
.bend-layout{box-sizing:border-box;page-break-inside:avoid;break-inside:avoid;border:1px solid #bbb;padding:6px 7px;border-radius:5px;background:#fafafa;}
.bend-title{font-weight:bold;margin:0 0 5px;font-size:10px;color:#000;border-bottom:1px solid #ddd;padding-bottom:3px;}
.bend-body{display:flex;gap:4px;align-items:flex-start;min-height:100px;}
.bend-drawing{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.compact-img{width:100%;height:auto;max-height:130px;object-fit:contain;mix-blend-mode:multiply;filter:invert(1) grayscale(1) brightness(1.15) contrast(1.5);display:block;}
.compact-img-container{flex:1;min-width:0;}
.compact-img-container svg{width:100%;height:auto;max-height:130px;display:block;mix-blend-mode:multiply;filter:invert(1) grayscale(1) brightness(1.15) contrast(1.5);}
.cuts-side{flex:0 0 28%;min-width:38px;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start;border-left:1px solid #ddd;padding-left:5px;font-size:8px;}
.cut-line{color:#222;font-weight:600;line-height:1.55;white-space:nowrap;}
.cut-divider{width:100%;border-top:1px solid #999;margin:2px 0;}
.cut-total{font-weight:900;color:#000;font-size:8.5px;white-space:nowrap;}
.report-header{display:flex;align-items:center;gap:12px;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:10px}
.report-header img{height:30px;object-fit:contain}
.total-box{margin-top:12px;padding:6px 8px;border:1px solid #000;width:100%;box-sizing:border-box;background:#fefefe;}
.total-box table{width:100%;text-align:right;font-size:10px;}
@media print{
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
  body{padding:0;margin:0;}
  .bends-container{display:grid !important;grid-template-columns:repeat(3,1fr) !important;gap:4px !important;}
  .bend-layout{page-break-inside:avoid !important;break-inside:avoid !important;}
  .compact-img,.compact-img-container svg{max-height:120px !important;}
}
</style></head><body>
${settings.reportLogo || settings.reportCompanyName ? `<div class="report-header">${settings.reportLogo ? `<img src="${settings.reportLogo}" alt="Logo"/>` : ''}<div><strong style="font-size:14px">${settings.reportCompanyName || ''}</strong></div></div>` : ''}
<h1>Orçamento #${q.id} (Obras)</h1>
<p style="margin: 0 0 12px 0;">Cliente: <b>${clientName || q.clientName || ''}</b></p>
${imgRows}
<div class="total-box">
    <table>
        <tr><td>Total m\u00b2:</td><td><b>${tM2.toFixed(2)} m\u00b2</b></td></tr>
        <tr><td>Custo Estimado (Obra):</td><td><b>R$ ${totalCostVal.toFixed(2)}</b></td></tr>
        <tr style="color:#666; font-size:9px"><td>Valor Venda Ref:</td><td>R$ ${tVal.toFixed(2)}</td></tr>
    </table>
</div>
<p style="margin-top:8px;color:#666;font-size:9px">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
<script>
window.onload = function() {
    var imgs = document.querySelectorAll('img');
    var total = imgs.length;
    if (total === 0) { window.print(); return; }
    var loaded = 0;
    function tryPrint() { loaded++; if (loaded >= total) window.print(); }
    imgs.forEach(function(img) {
        if (img.complete) { tryPrint(); }
        else { img.onload = tryPrint; img.onerror = tryPrint; }
    });
};
</script>
</body></html>`;

        const w2 = existingWindow || window.open('', '_blank');
        if (w2) {
            if (existingWindow) w2.document.body.innerHTML = '';
            w2.document.write(html);
            w2.document.close();
        }
    };

    const handleDownloadQuotePDF = (q: any, qBends: any[], existingWindow?: Window | null) => {

        const pm2 = parseFloat(settings.pricePerM2 || '50');
        const opt = calculateOptimization(qBends.filter(b => b.productType !== 'service').map(b => ({ ...b, id: b.id || Math.random().toString(), lengths: b.lengths || [] })));

        const filteredBends = qBends.filter(b => b.productType !== 'service');
        const isGroupedQuote = q && typeof q.is_grouped === 'boolean' ? q.is_grouped : groupByRoom;

        const grouped = qBends.reduce((acc, b) => {
            const key = isGroupedQuote ? (b.group_name || 'Sem Grupo') : 'Sem Grupo';
            if (!acc[key]) acc[key] = [];
            acc[key].push(b);
            return acc;
        }, {} as Record<string, any[]>);


        const imgRows = Object.entries(grouped).map(([gName, gBendsValue]) => {
            const gBends = gBendsValue as any[];
            const groupTitleHtml = (isGroupedQuote && gName !== 'Sem Grupo')
                ? `<h3 style="font-size:16px; margin: 24px 0 12px; padding-bottom: 4px; border-bottom: 2px solid #6366f1; color: #1e293b;">Grupo: ${gName}</h3>`
                : '';

            const bRows = gBends.map((b: any) => {
                const i = qBends.findIndex(x => x === b);
                const pCount = qBends.filter((item, idx) => idx < i && item.productType !== 'service').length + 1;
                const sCount = qBends.filter((item, idx) => idx < i && item.productType === 'service').length + 1;

                if (b.productType === 'service') {
                    return `
                    <div style="margin:16px 0;page-break-inside:avoid;border:1px solid #ddd;padding:12px;border-radius:8px;border-left:5px solid #a855f7;">
                        <p style="font-weight:bold;margin:0 0 8px;font-size:14px;color:#6d28d9">Serviço #${sCount}</p>
                        <p style="font-size:12px;color:#444;white-space:pre-wrap;margin-bottom:8px">${b.serviceDescription || ''}</p>
                        <p style="text-align:right;font-weight:bold;color:#4338ca">Qtd: ${b.serviceQty} | R$ ${b.serviceValue?.toFixed(2)} | Subtotal: R$ ${((b.serviceValue || 0) * (b.serviceQty || 1)).toFixed(2)}</p>
                    </div>`;
                }
                const cuts = Array.isArray(b.lengths) ? b.lengths.filter((l: any) => parseFloat(l) > 0) : [];
                const cutsHtml = cuts.length > 0 ? `<div class="cuts-table">${cuts.map((c: any, ci: number) => {
                    const seq = opt.pieceToSeq[`${b.id}-${ci}`];
                    return `<div class="cr"><span class="cn" title="Chapa ${seq?.join(',') || '?'}">C${ci + 1}</span><b class="cv">${parseFloat(c).toFixed(2)}m</b></div>`;
                }).join('')
                    }<div class="ct"><span>Total</span><b>${(b.totalLengthM || 0).toFixed(2)}m</b></div></div>` : '';
                const img = b.svgDataUrl ? `<img src="${b.svgDataUrl}" class="bc-img"/>` : '';
                return `<div class="bend-card">
                    <p class="bc-title">Dobra #${pCount} — <span class="medida">${((b.roundedWidthCm || 0) / 100).toFixed(2)}m larg.</span></p>
                    <div class="bc-body">
                        <div class="bc-draw">${img}</div>
                        ${cutsHtml}
                    </div>
                </div>`;
            }).join('');
            if (!isGroupedQuote) return `<div class="bends-grid">${bRows}</div>`;
            const groupHeader = (isGroupedQuote && gName !== 'Sem Grupo')
                ? `<h3 style="font-size:14px;font-weight:bold;margin:16px 0 8px;padding:4px 0 4px 10px;border-left:5px solid #6366f1;background:#f1f5ff;">\ud83c\udfe0 ${gName}</h3>`
                : '';
            return groupHeader + `<div class="bends-grid">${bRows}</div>`;
        }).join('');

        const rows = Object.entries(grouped).map(([gName, gBendsValue]) => {
            const gBends = gBendsValue as any[];
            const hasGroups = Object.keys(grouped).length > 1;
            const groupHeader = hasGroups && gName !== 'Sem Grupo'
                ? `<tr><td colspan="6" style="background:#f1f5f9; font-weight:bold; color:#334155; text-align:left; padding:8px 12px; border-bottom:1px solid #cbd5e1;">✅ Grupo: ${gName}</td></tr>`
                : '';

            const bRows = gBends.map((b: any) => {
                const i = qBends.findIndex(x => x === b);
                if (b.productType === 'service') {
                    return `<tr><td>#${i + 1}</td><td colspan="3" align="left"><b>SERVIÇO:</b> ${b.serviceDescription || ''}</td><td>Qtd: ${b.serviceQty}</td><td style="color:#6d28d9">R$ ${((b.serviceValue || 0) * (b.serviceQty || 1)).toFixed(2)}</td></tr>`;
                }
                const lengths = Array.isArray(b.lengths) ? b.lengths : [];
                const totalLen = b.totalLengthM || lengths.filter((l: any) => parseFloat(l) > 0).reduce((a: number, c: any) => a + parseFloat(c), 0);
                const w = b.roundedWidthCm || 0;
                const m2 = b.m2 || (w / 100 * totalLen);
                return `<tr><td>#${i + 1}</td><td>${(b.risks || []).map((r: any) => {
                    const icon = DIRECTION_ICONS[r.direction as RiskDirection] || '';
                    const sd = r.slopeData || r.slope_data;
                    if (sd) return `${icon} <span style="color:#b45309">${sd.side} ${sd.h1}/${sd.h2}</span>`;
                    return `${icon} ${r.sizeCm}`;
                }).join(', ')}</td><td class="medida">${(w / 100).toFixed(2)}m</td><td class="metros">${lengths.filter((l: any) => parseFloat(l) > 0).join('+')}=${totalLen.toFixed(2)}m</td><td>${m2.toFixed(2)}</td><td>R$${(m2 * pm2).toFixed(2)}</td></tr>`;
            }).join('');
            return groupHeader + bRows;
        }).join('');

        const optHtml = `<div style="margin-top:24px;page-break-before:always">
            <h2 style="font-size:18px;border-bottom:2px solid #6366f1;padding-bottom:8px">🧮 Plano de Corte Otimizado (Chapas 1,20m)</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px;margin-top:12px">
                ${opt.bins.map((bin, bi) => `
                    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#f8fafc">
                        <strong style="display:block;margin-bottom:8px;color:#1e293b;border-bottom:1px solid #e2e8f0">Chapa #${bi + 1}</strong>
                        ${bin.pieces.map((p: any) => {
            const bendIdx = qBends.findIndex((b: any) => b.id === p.bendId);
            return `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                                <span><b style="color:#6366f1">(Corte ${p.originalIdx + 1})</b> Dobra #${bendIdx + 1}</span>
                                <strong>${p.length.toFixed(2)}m</strong>
                            </div>`;
        }).join('')}
                        <div style="margin-top:8px;padding-top:4px;border-top:1px dashed #cbd5e1;font-size:11px;color:#ef4444;text-align:right">
                            Sobra: <b>${bin.scrap.toFixed(2)}m</b>
                        </div>
                    </div>
                `).join('')}
            </div>
            <p style="font-size:12px;color:#64748b;margin-top:12px">Total de chapas necessárias: <b>${opt.bins.length} de 1,20m</b></p>
        </div>`;

        const tM2 = parseFloat(q.totalM2 || 0);
        const tVal = parseFloat(q.finalValue || q.totalValue || 0);
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orçamento #${q.id}</title><style>
body{font-family:Arial,sans-serif;padding:20px;color:#111;max-width:900px;margin:auto}
h1{font-size:18px;margin-bottom:4px}
.status{display:inline-block;background:#fef3c7;color:#92400e;border:2px solid #f59e0b;font-weight:bold;font-size:12px;padding:4px 10px;border-radius:6px;margin:6px 0}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
th{background:#1e293b;color:#fff;text-align:left;padding:8px}
td{padding:6px 8px;border-bottom:1px solid #e8e8e8}
tr:nth-child(even) td{background:#f8fafc}
.big{font-size:16px;font-weight:bold;color:#16a34a}
.metros{font-size:14px;font-weight:bold;background:#eef2ff;border:2px solid #6366f1;padding:4px 10px;border-radius:5px;color:#4338ca}
.medida{font-size:12px;font-weight:bold;color:#1e40af}
.cuts-table{width:100%;border-collapse:collapse;margin:0;font-size:11px;border:1px solid #6366f1;overflow:hidden}
.cuts-table th{background:#4338ca;color:#fff;padding:4px 8px;font-size:10px;text-align:center}
.cuts-table td{padding:4px 8px;border-bottom:1px solid #e0e7ff;background:#eef2ff;font-size:10px}
.cuts-table .cut-val{font-weight:bold;color:#4338ca;text-align:right}
.cuts-table .cut-total{background:#c7d2fe}
.cuts-table .cut-total td{font-weight:900;border-bottom:none}
.report-header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:12px}
.report-header img{height:44px;object-fit:contain}
.report-header .info{font-size:10px;color:#64748b}
.report-footer{border-top:2px solid #e2e8f0;padding-top:10px;margin-top:20px;text-align:center;font-size:10px;color:#94a3b8}
.bends-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.bend-card{box-sizing:border-box;border:1px solid #e2e8f0;border-radius:6px;padding:7px;background:#f8fafc;page-break-inside:avoid;break-inside:avoid;}
.bc-title{font-weight:bold;margin:0 0 5px;font-size:11px;color:#111;border-bottom:1px solid #e2e8f0;padding-bottom:3px;}
.bc-body{display:flex;gap:5px;align-items:flex-start;min-height:100px;}
.bc-draw{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.bc-img{width:100%;height:auto;max-height:140px;object-fit:contain;background:#1e293b;border-radius:5px;display:block;}
.cuts-table{flex:0 0 28%;min-width:44px;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start;border-left:1px solid #e2e8f0;padding-left:6px;font-size:8.5px;}
.cr{color:#374151;font-weight:600;line-height:1.6;display:flex;gap:3px;align-items:center;white-space:nowrap;}
.cn{font-size:7.5px;color:#6366f1;font-weight:700;}
.cv{color:#1e40af;}
.ct{font-weight:900;color:#111;font-size:9px;border-top:1px solid #94a3b8;margin-top:2px;padding-top:2px;display:flex;gap:3px;align-items:center;}
@media print{
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
  html, body { width: 210mm; height: 297mm; margin: 0; padding: 10mm; }
  body{padding:6px}
  .bends-grid{display:grid !important;grid-template-columns:repeat(3,1fr) !important;gap:5px !important;}
  .bend-card{page-break-inside:avoid !important;break-inside:avoid !important;}
  .bc-img{max-height:130px !important;}
}
</style></head><body>
${settings.reportLogo || settings.reportCompanyName ? `<div class="report-header">${settings.reportLogo ? `<img src="${settings.reportLogo}" alt="Logo"/>` : ''}<div><strong style="font-size:16px">${settings.reportCompanyName || ''}</strong><div class="info">${[settings.reportPhone, settings.reportEmail].filter(Boolean).join(' | ')}${settings.reportAddress ? `<br/>${settings.reportAddress}` : ''}${settings.reportHeaderText ? `<br/>${settings.reportHeaderText}` : ''}</div></div></div>` : ''}
<h1>Orçamento #${q.id} — ${settings.reportCompanyName || 'Ferreira Calhas'}</h1>
<p>Cliente: <b>${q.clientName || ''}</b>${q.notes ? ` | Obs: ${q.notes}` : ''}</p>
<div class="status">\u23f3 STATUS: ${(STATUS_LABELS[q.status]?.label || q.status).toUpperCase()}</div>
${imgRows}
<table><thead><tr><th>#</th><th>Riscos</th><th>Largura</th><th style="background:#4338ca">Metros corridos</th><th>m\u00b2</th><th>Valor</th></tr></thead><tbody>${rows}</tbody>
<tfoot>
<tr><td colspan="4" align="right">Total m\u00b2:</td><td colspan="2"><b>${tM2.toFixed(2)} m\u00b2</b></td></tr>
<tr><td colspan="4" align="right">Pre\u00e7o/m\u00b2:</td><td colspan="2">R$ ${pm2.toFixed(2)}</td></tr>
<tr><td colspan="4" align="right" style="font-size:18px;font-weight:900">TOTAL:</td><td colspan="2" class="big">R$ ${tVal.toFixed(2)}</td></tr>
</tfoot></table>
${optHtml}
${settings.reportFooterText ? `<div class="report-footer">${settings.reportFooterText}</div>` : ''}
<p style="margin-top:16px;color:#888;font-size:11px">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
<script>
window.onload = function() {
    var imgs = document.querySelectorAll('img');
    var total = imgs.length;
    if (total === 0) { window.print(); return; }
    var loaded = 0;
    function tryPrint() { loaded++; if (loaded >= total) window.print(); }
    imgs.forEach(function(img) {
        if (img.complete) { tryPrint(); }
        else { img.onload = tryPrint; img.onerror = tryPrint; }
    });
};
</script>
</body></html>`;

        const w2 = existingWindow || window.open('', '_blank');
        if (w2) {
            if (existingWindow) w2.document.body.innerHTML = '';
            w2.document.write(html);
            w2.document.close();
        }
    };

    const handleUploadProof = async () => {
        if (!proofFile || !savedQuote) return;
        setUploadingProof(true);
        try {
            const fd = new FormData(); fd.append('proof', proofFile);
            const res = await fetch(`/api/quotes/${savedQuote.id}/proof`, { method: 'POST', body: fd, credentials: 'include' });
            if (res.ok) {
                setToast({ msg: 'Comprovante enviado!', type: 'success' });
                setProofFile(null);
            } else {
                const err = await res.json().catch(() => ({}));
                setToast({ msg: err.error || 'Erro ao enviar comprovante', type: 'error' });
            }
        } catch {
            setToast({ msg: 'Erro de conexão ao enviar comprovante', type: 'error' });
        } finally {
            setUploadingProof(false);
        }
    };


    const handleDownloadPDF = () => {
        const pm2 = parseFloat(settings.pricePerM2 || '50');
        const imgRows = bends.map((b, i) => {
            if (b.productType === 'service') {
                return `<div style="margin:16px 0;page-break-inside:avoid;border:1px solid #ddd;padding:12px;border-radius:8px;border-left:5px solid #a855f7;">
                    <p style="font-weight:bold;margin:0 0 8px;font-size:14px;color:#6d28d9">Serviço #${i + 1}</p>
                    <p style="font-size:12px;color:#444;white-space:pre-wrap;margin-bottom:8px">${b.serviceDescription || ''}</p>
                    <p style="text-align:right;font-weight:bold;color:#4338ca">Qtd: ${b.serviceQty} | R$ ${b.serviceValue?.toFixed(2)} | Subtotal: R$ ${((b.serviceValue || 0) * (b.serviceQty || 1)).toFixed(2)}</p>
                </div>`;
            }
            const cuts = b.lengths.filter(l => parseFloat(l) > 0);
            const cutsHtml = cuts.length > 0 ? `<table class="cuts-table"><thead><tr><th colspan="2">Cortes</th></tr></thead><tbody>${cuts.map((c, ci) => `<tr><td>Corte ${ci + 1}</td><td class="cut-val">${parseFloat(c).toFixed(2)}m</td></tr>`).join('')}<tr class="cut-total"><td>Metros corridos</td><td class="cut-val">${b.totalLengthM.toFixed(2)}m</td></tr></tbody></table>` : '';

            let img = '';
            if (b.svgDataUrl) {
                img = `<img src="${b.svgDataUrl}" style="width:100%;max-height:180px;object-fit:contain;background:#1e293b;border-radius:8px"/>`;
            } else if (b.risks && b.risks.length > 0) {
                img = `<div style="width:100%;max-height:180px;overflow:hidden;border-radius:8px">${renderToString(<BendCanvas risks={b.risks} maxWidthCm={120} exportMode={true} />)}</div>`;
            }

            return `<div style="margin:16px 0;page-break-inside:avoid"><p style="font-weight:bold;margin:0 0 8px;font-size:14px">Dobra #${i + 1} — <span class="medida">${(b.roundedWidthCm / 100).toFixed(2)}m larg.</span></p><div style="display:flex;gap:16px;align-items:flex-start">${img ? `<div style="flex:1">${img}</div>` : ''}${cutsHtml ? `<div style="flex:0 0 200px">${cutsHtml}</div>` : ''}</div></div>`;
        }).join('');

        const rows = bends.map((b, i) => {
            if (b.productType === 'service') {
                return `<tr><td>#${i + 1}</td><td colspan="3" align="left"><b>SERVIÇO:</b> ${b.serviceDescription || ''}</td><td>Qtd: ${b.serviceQty}</td><td style="color:#6d28d9">R$ ${((b.serviceValue || 0) * (b.serviceQty || 1)).toFixed(2)}</td></tr>`;
            }
            return `<tr><td>#${i + 1}</td><td>${b.risks.map(r => {
                const icon = DIRECTION_ICONS[r.direction];
                const sd = r.slopeData || r.slope_data;
                if (sd) return `${icon} <span style="color:#b45309">${sd.side} ${sd.h1}/${sd.h2}</span>`;
                return `${icon} ${r.sizeCm}`;
            }).join(', ')}</td><td class="medida">${(b.roundedWidthCm / 100).toFixed(2)}m</td><td class="metros">${b.lengths.filter(l => parseFloat(l) > 0).join('+')}=${b.totalLengthM.toFixed(2)}m</td><td>${b.m2.toFixed(4)}</td><td>R$${(b.m2 * pm2).toFixed(2)}</td></tr>`;
        }).join('');

        const tM2 = totalM2;
        const tVal = totalValue;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orçamento Ferreira Calhas</title><style>
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
${settings.reportLogo || settings.reportCompanyName ? `<div class="report-header">${settings.reportLogo ? `<img src="${settings.reportLogo}" alt="Logo"/>` : ''}<div><strong style="font-size:16px">${settings.reportCompanyName || ''}</strong><div class="info">${[settings.reportPhone, settings.reportEmail].filter(Boolean).join(' | ')}${settings.reportAddress ? `<br/>${settings.reportAddress}` : ''}${settings.reportHeaderText ? `<br/>${settings.reportHeaderText}` : ''}</div></div></div>` : ''}
<h1>Orçamento — ${settings.reportCompanyName || 'Ferreira Calhas'}</h1>
<p style="color:#555;font-size:12px">${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
<p>Cliente: <b>${clientName || user?.name || user?.username || ''}</b>${notes ? ` | Obs: ${notes}` : ''}</p>
<div class="status">\u23f3 STATUS: AGUARDANDO PAGAMENTO</div>
${imgRows}
<table><thead><tr><th>#</th><th>Riscos</th><th>Largura</th><th style="background:#4338ca">Metros corridos</th><th>m\u00b2</th><th>Valor</th></tr></thead><tbody>${rows}</tbody>
<tfoot>
<tr><td colspan="4" align="right">Total m\u00b2:</td><td colspan="2"><b>${totalM2.toFixed(2)} m\u00b2</b></td></tr>
<tr><td colspan="4" align="right">Pre\u00e7o/m\u00b2:</td><td colspan="2">R$ ${pricePerM2.toFixed(2)}</td></tr>
<tr><td colspan="4" align="right" style="font-weight:bold">TOTAL A PAGAR:</td><td colspan="2" class="big">R$ ${totalValue.toFixed(2)}</td></tr>
</tfoot></table>
${settings.reportFooterText ? `<div class="report-footer">${settings.reportFooterText}</div>` : ''}
<script>
window.onload = function() {
    var imgs = document.querySelectorAll('img');
    var total = imgs.length;
    if (total === 0) { window.print(); return; }
    var loaded = 0;
    function tryPrint() { loaded++; if (loaded >= total) window.print(); }
    imgs.forEach(function(img) {
        if (img.complete && img.naturalWidth > 0) { tryPrint(); }
        else { img.onload = tryPrint; img.onerror = tryPrint; }
    });
};
<\/script>
</body></html>`;
        const b2 = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(b2);
        const w = window.open(url, '_blank');
        if (w) setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    // ── Render helpers ────────────────────────────────────────────────────────
    // ── Render helpers (Desktop) ──
    const DirBtnDesktop = ({ d, active, onClick }: { d: typeof DIR_GRID[0]; active: boolean; onClick: () => void }) => (
        <button onClick={onClick} className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 font-bold text-xs transition-all cursor-pointer
            ${active ? `bg-gradient-to-br ${d.grad} border-transparent text-white shadow-lg scale-105` : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white'}`}>
            <span className="text-3xl leading-none">{d.icon}</span>
            <span className="text-center leading-tight mt-1">{d.label}</span>
        </button>
    );

    // ── Render helpers (Mobile) ──
    const DirBtn = ({ d, active, onClick }: { d: typeof DIR_GRID[0]; active: boolean; onClick: () => void }) => (
        <button onClick={onClick} className={`relative aspect-square flex flex-col items-center justify-center p-1.5 rounded-2xl border-2 font-black transition-all active:scale-90
            ${active
                ? `bg-brand-primary border-brand-primary text-white shadow-xl shadow-blue-500/30`
                : 'bg-white border-slate-200 text-slate-400 shadow-sm'}`}>
            <span className="text-xl leading-none mb-0.5">{active ? <Check className="w-4 h-4" /> : d.icon}</span>
            <span className="text-[7px] uppercase tracking-tighter text-center">{d.label}</span>
        </button>
    );

    // ════════════════════════════ RENDER ════════════════════════════════════
    // ════════════════════════════ RENDER ════════════════════════════════════
    return (
        <div className={`min-h-screen ${isMobile ? 'bg-slate-900' : 'bg-slate-50'}`} ref={topRef}>
            {renderModals()}
            {isMobile ? renderMobileUI() : renderDesktopUI()}
        </div>
    );

    function renderModals() {
        return (
            <>
                {/* Library Zoom Modal */}
                <AnimatePresence>
                    {libraryZoom && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
                            onClick={() => setLibraryZoom(null)}>
                            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                                className="bg-slate-800 border border-white/20 rounded-3xl p-6 max-w-lg w-full space-y-4"
                                onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-white font-bold text-lg">📐 Dobra Salva</h3>
                                    <button onClick={() => setLibraryZoom(null)} className="text-white/60 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
                                </div>
                                {libraryZoom.svgDataUrl && (
                                    <img src={libraryZoom.svgDataUrl} alt="Dobra" className="w-full rounded-xl" style={{ maxHeight: 300, objectFit: 'contain', background: '#1e293b' }} />
                                )}
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-white/5 rounded-xl p-3">
                                        <p className="text-slate-400 text-xs">Largura</p>
                                        <p className="text-white font-black text-lg">{libraryZoom.roundedWidthCm}</p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3">
                                        <p className="text-slate-400 text-xs">Riscos</p>
                                        <p className="text-white font-bold">{libraryZoom.risks.length}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3">
                                    <p className="text-slate-400 text-xs mb-1">Detalhes dos riscos</p>
                                    <div className="flex flex-wrap gap-2">
                                        {libraryZoom.risks.map((r, i) => (
                                            <span key={i} className="text-white bg-white/10 px-2 py-1 rounded-lg text-sm font-bold">
                                                {DIRECTION_ICONS[r.direction]} {r.sizeCm}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => { setCurrentRisks(libraryZoom.risks); setLibraryZoom(null); setShowLibrary(false); }}
                                        className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2">
                                        <Plus className="w-4 h-4" /> Usar esta dobra
                                    </button>
                                    <button onClick={() => setLibraryZoom(null)}
                                        className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl cursor-pointer">
                                        Fechar
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Report View Modal */}
                <AnimatePresence>
                    {reportQuote && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 overflow-auto"
                            onClick={() => setReportQuote(null)}>
                            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                                className="bg-slate-800 border border-white/20 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4"
                                onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-white font-black text-lg">📊 Relatório — Orçamento #{reportQuote.id}</h3>
                                    <button onClick={() => setReportQuote(null)} className="text-white/60 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="text-slate-400">Cliente:</span>
                                    <span className="text-white font-bold">{reportQuote.clientName || 'N/A'}</span>
                                    <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full text-white ${(STATUS_LABELS[reportQuote.status] || STATUS_LABELS.pending).color}`}>
                                        {(STATUS_LABELS[reportQuote.status] || STATUS_LABELS.pending).label}
                                    </span>
                                </div>
                                <div className="text-right text-green-400 font-black text-2xl">
                                    R$ {parseFloat(reportQuote.finalValue || reportQuote.totalValue || 0).toFixed(2)}
                                </div>
                                {reportBends.length > 0 ? (() => {
                                    const reportOpt = calculateOptimization(reportBends);
                                    return (
                                        <>
                                            <div className="space-y-4">
                                                {reportBends.map((b: any, bi: number) => {
                                                    const isServiceItem = b.productType === 'service';
                                                    const cuts = Array.isArray(b.lengths) ? b.lengths.filter((l: any) => parseFloat(l) > 0) : [];
                                                    if (isServiceItem) {
                                                        return (
                                                            <div key={bi} className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-purple-300 font-bold">Serviço #{bi + 1}</p>
                                                                    <p className="text-purple-400 font-black">R$ {((b.serviceValue || 0) * (b.serviceQty || 1)).toFixed(2)}</p>
                                                                </div>
                                                                <p className="text-slate-400 text-xs">{b.serviceDescription || 'Serviço'}</p>
                                                                <p className="text-slate-500 text-xs">Quantidade: {b.serviceQty || 1} &times; R$ {(b.serviceValue || 0).toFixed(2)}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div key={bi} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-white font-bold">Dobra #{bi + 1}</p>
                                                                <p className="text-blue-400 font-black">{((b.roundedWidthCm || 0) / 100).toFixed(2)}m larg.</p>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                <div className="relative">
                                                                    <BendCanvas
                                                                        risks={(b.risks || []).map((r: any, ri: number) => ri === 0 ? { ...r, executionIdx: getBendExecutionLabels(b.id, b.lengths) } : r)}
                                                                        exportMode={true}
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <div className="bg-white/5 rounded-xl p-3">
                                                                        <p className="text-slate-400 text-xs mb-1 uppercase tracking-tighter font-bold">Riscos da Dobra</p>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {(b.risks || []).map((r: any, ri: number) => {
                                                                                const icon = DIRECTION_ICONS[r.direction as RiskDirection] || '';
                                                                                const sd = r.slopeData || r.slope_data;
                                                                                return (
                                                                                    <span key={ri} className="bg-white/10 text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10">
                                                                                        {icon} {sd ? `${sd.side} ${sd.h1}/${sd.h2}` : r.sizeCm}
                                                                                    </span>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                    {cuts.length > 0 && (
                                                                        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3">
                                                                            <p className="text-indigo-300 text-[10px] font-black mb-2 uppercase tracking-tighter">Ordem de Corte</p>
                                                                            <div className="space-y-1">
                                                                                {cuts.map((c: any, ci: number) => {
                                                                                    const len = parseFloat(c);
                                                                                    const seq = reportOpt.pieceToSeq[`${b.id}-${ci}`];
                                                                                    return (
                                                                                        <div key={ci} className="flex justify-between items-center text-xs">
                                                                                            <span className="text-white/50">
                                                                                                <b className="text-indigo-400">(Chapas {seq?.join(',') || '?'})</b> Corte {ci + 1}
                                                                                            </span>
                                                                                            <span className="text-white font-black">{len.toFixed(2)}m</span>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 mt-6 space-y-4 shadow-2xl relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
                                                <h3 className="text-lg font-black text-white flex items-center gap-2 relative z-10">
                                                    <List className="w-5 h-5 text-blue-400" /> Plano de Corte Otimizado
                                                </h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                                                    {reportOpt.bins.map((bin, index) => (
                                                        <div key={index} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 relative group overflow-hidden">
                                                            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                                                <span className="text-blue-400 font-extrabold flex items-center gap-2">
                                                                    <span className="w-5 h-5 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">#{index + 1}</span>
                                                                    Chapa Principal
                                                                </span>
                                                                <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest text-right">Materia Prima<br />1,20 Metros</span>
                                                            </div>
                                                            <div className="space-y-1.5 pt-1">
                                                                {bin.pieces.map((p: any, pi: number) => {
                                                                    const bIdx = reportBends.findIndex((bend: any) => bend.id === p.bendId);
                                                                    return (
                                                                        <div key={pi} className="flex justify-between text-xs px-2 py-1.5 bg-white/5 rounded-lg border border-white/5 hover:border-blue-500/30 transition-all">
                                                                            <span className="text-slate-300">
                                                                                <b className="text-blue-400 mr-2">(Corte {p.originalIdx + 1})</b>
                                                                                Dobra #{bIdx + 1}
                                                                            </span>
                                                                            <span className="text-white font-black">{p.length.toFixed(2)}m</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            <div className="pt-2 flex justify-between items-center bg-red-400/5 -mx-4 -mb-4 px-4 py-3 mt-2 border-t border-red-500/10">
                                                                <span className="text-red-400/70 text-[10px] font-black uppercase tracking-wider">Perda / Retalho</span>
                                                                <span className="text-red-400 font-black text-sm">{bin.scrap.toFixed(2)}m</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="pt-4 text-center border-t border-white/5 text-slate-500 text-xs relative z-10">
                                                    Total de chapas necessárias: <b className="text-blue-400">{reportOpt.bins.length} de 1,20m</b>
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-3">
                                                <button onClick={() => {
                                                    const w2 = window.open('', '_blank');
                                                    w2?.document.write('Gerando modelo A4 Compacto...');
                                                    handleDownloadQuoteCompactPDF(reportQuote, reportBends, w2);
                                                }}
                                                    className="flex-1 px-4 py-4 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-lg transition-all">
                                                    <Printer className="w-5 h-5" /> A4 Compacto
                                                </button>
                                                <button onClick={() => handleDownloadQuotePDF(reportQuote, reportBends)}
                                                    className="flex-1 px-4 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all">
                                                    <FileDown className="w-5 h-5" /> Baixar PDF Completo
                                                </button>
                                                <button onClick={() => setReportQuote(null)}
                                                    className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl cursor-pointer transition-all">
                                                    Fechar
                                                </button>
                                            </div>
                                        </>
                                    );
                                })() : (
                                    <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                                        <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-20" />
                                        <p className="text-slate-500 text-sm font-bold">Nenhuma dobra encontrada neste orçamento.</p>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Toast */}
                <AnimatePresence>
                    {toast && (
                        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-2xl text-white font-bold shadow-xl ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                            {toast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Image zoom */}
                <AnimatePresence>
                    {zoomImg && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9998] bg-black/80 flex items-center justify-center p-4"
                            onClick={() => setZoomImg(null)}>
                            <button className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full cursor-pointer"><X className="w-6 h-6" /></button>
                            <img src={zoomImg} alt="Zoom" className="max-w-full max-h-full rounded-2xl" onClick={e => e.stopPropagation()} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Cancel Modal (Desktop Style for Desktop, but we'll adapt or keep mobile) */}
                <AnimatePresence>
                    {cancelModalQuote && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-slate-800 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative border border-white/10">
                                <div className="absolute top-0 right-0 p-6">
                                    <button onClick={() => setCancelModalQuote(null)} className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all cursor-pointer">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                                        <XCircle className="w-7 h-7 text-red-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white">Cancelar Orçamento</h3>
                                        <p className="text-sm font-bold text-white/40 uppercase tracking-widest mt-1">
                                            Ref: #{String(cancelModalQuote.id).substring(0, 8).toUpperCase()}
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!cancelModalQuote) return;
                                    if (!cancelReason) {
                                        setToast({ msg: 'Selecione um motivo para o cancelamento.', type: 'error' });
                                        return;
                                    }
                                    if (cancelReason === 'outro' && !cancelReasonText.trim()) {
                                        setToast({ msg: 'Descreva o motivo do cancelamento.', type: 'error' });
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
                                            setToast({ msg: 'Orçamento cancelado.', type: 'success' });
                                            fetch('/api/quotes', { credentials: 'include' }).then(r => r.json()).then(setMyQuotes).catch(() => { });
                                            setCancelModalQuote(null);
                                        } else {
                                            const err = await res.json();
                                            setToast({ msg: err.error || 'Erro ao cancelar orçamento.', type: 'error' });
                                        }
                                    } catch (error) {
                                        setToast({ msg: 'Erro de comunicação com o servidor.', type: 'error' });
                                    } finally {
                                        setCanceling(false);
                                    }
                                }} className="space-y-4 text-left">
                                    <div>
                                        <label className="text-xs font-bold text-white/50 uppercase ml-1 block mb-3 tracking-wider">Motivo do Cancelamento</label>
                                        <div className="space-y-2">
                                            {[
                                                { id: 'cliente_desistiu', label: 'Cliente desistiu' },
                                                { id: 'perdeu_concorrencia', label: 'Perdeu para concorrência' },
                                                { id: 'preco_alto', label: 'Preço alto' },
                                                { id: 'servico_adiado', label: 'Serviço adiado' },
                                                { id: 'outro', label: 'Outro' }
                                            ].map(opt => (
                                                <label key={opt.id} className="flex items-center p-3 border border-white/10 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                                                    <input type="radio" name="cancel_reason" value={opt.id} checked={cancelReason === opt.id} onChange={() => setCancelReason(opt.id)} className="w-4 h-4 text-red-500 border-white/20 focus:ring-red-500 bg-transparent" />
                                                    <span className="ml-3 text-sm font-medium text-white/90">{opt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {cancelReason === 'outro' && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                            <label className="text-xs font-bold text-white/50 uppercase ml-1 block mb-2 tracking-wider mt-4">Descreva o motivo (obrigatório)</label>
                                            <textarea required value={cancelReasonText} onChange={e => setCancelReasonText(e.target.value)} rows={3}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-red-500/20 placeholder-white/20"
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
            </>
        );
    }

    function renderMobileUI() {
        return (
            <div className="pb-32 pt-6 px-4">

                <AnimatePresence>
                    {
                        toast && (
                            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-2xl text-white font-bold shadow-xl ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                                {toast.msg}
                            </motion.div>
                        )
                    }
                </AnimatePresence >

                {/* Image zoom */}
                <AnimatePresence>
                    {
                        zoomImg && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[9998] bg-black/80 flex items-center justify-center p-4"
                                onClick={() => setZoomImg(null)}>
                                <button className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full cursor-pointer"><X className="w-6 h-6" /></button>
                                <img src={zoomImg} alt="Zoom" className="max-w-full max-h-full rounded-2xl" onClick={e => e.stopPropagation()} />
                            </motion.div>
                        )
                    }
                </AnimatePresence >

                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <h1 className="text-4xl font-black text-white mb-2">📐 Calculadora de Orçamento</h1>
                        <p className="text-slate-400">Monte as dobras e gere o orçamento automaticamente</p>
                    </div>

                    {/* Steps */}
                    <div className="flex items-center justify-center gap-4">
                        {(['bends', 'summary', 'payment'] as const).map((s, i) => (
                            <React.Fragment key={s}>
                                <div className={`px-4 py-2 rounded-full text-sm font-bold ${step === s ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/40'}`}>
                                    {i + 1}. {s === 'bends' ? 'Dobras' : s === 'summary' ? 'Resumo' : 'Envio'}
                                </div>
                                {i < 2 && <ChevronRight className="w-4 h-4 text-white/30" />}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* ══ MY QUOTES LISTING (Redesigned for Mobile) ══ */}
                    {showMyQuotes && step === 'bends' && myQuotes.length > 0 && bends.length === 0 && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20 px-1">
                            <div className="flex items-center justify-between px-2">
                                <div>
                                    <h2 className="text-2xl font-black text-white leading-tight">Meus Orçamentos</h2>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5">{myQuotes.length} registros encontrados</p>
                                </div>
                                <button onClick={() => { handleResetQuote(); setShowMyQuotes(false); }}
                                    className="w-14 h-14 bg-brand-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-90 transition-all">
                                    <Plus className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {myQuotes.map(q => {
                                    const st = STATUS_LABELS[q.status] || STATUS_LABELS.pending;
                                    const isDraft = q.status === 'draft' || q.status === 'rascunho';
                                    const quoteNum = String(q.id).substring(0, 8).toUpperCase();

                                    return (
                                        <div key={q.id} className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100 flex flex-col gap-5">
                                            {/* Top Info */}
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${st.color.replace('bg-', 'bg-')}`}></span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{st.label}</span>
                                                    </div>
                                                    <h3 className="text-lg font-black text-slate-900 leading-tight truncate max-w-[180px]">
                                                        {q.clientName || 'Cliente sem nome'}
                                                    </h3>
                                                    <p className="text-[10px] font-mono text-slate-400">ID: #{quoteNum} • {new Date(q.createdAt).toLocaleDateString('pt-BR')}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total</p>
                                                    <p className="text-xl font-black text-brand-primary">R$ {parseFloat(q.finalValue || q.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>

                                            {/* Action Bar */}
                                            <div className="flex gap-2 pt-1 border-t border-slate-50 overflow-x-auto no-scrollbar pb-1">
                                                {isDraft ? (
                                                    <button onClick={() => handleEditQuote(q)}
                                                        className="flex-1 min-w-[100px] h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:bg-blue-100 transition-all">
                                                        <PenLine className="w-3.5 h-3.5" /> Editar
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleViewReport(q)}
                                                        className="flex-1 min-w-[100px] h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:bg-slate-100 transition-all">
                                                        <Eye className="w-3.5 h-3.5" /> Ver
                                                    </button>
                                                )}

                                                <button onClick={() => navigate(`/fabricacao/${q.id}`)}
                                                    className="h-12 w-12 bg-brand-secondary/10 text-brand-secondary rounded-2xl flex items-center justify-center active:scale-95 transition-all" title="Fabricação">
                                                    <Hammer className="w-5 h-5" />
                                                </button>

                                                <button onClick={() => window.open(`/api/quotes/${q.id}/client-report`, '_blank')}
                                                    className="h-12 w-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center active:scale-95 transition-all" title="PDF Cliente">
                                                    <FileDown className="w-5 h-5" />
                                                </button>

                                                <button onClick={() => {
                                                    setCancelModalQuote(q);
                                                    setCancelReason('');
                                                    setCancelReasonText('');
                                                }}
                                                    className="h-12 w-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center active:scale-95 transition-all" title="Cancelar">
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* MODAL DE CANCELAMENTO CENTRAL */}
                    <AnimatePresence>
                        {cancelModalQuote && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-slate-800 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative border border-white/10">
                                    <div className="absolute top-0 right-0 p-6">
                                        <button onClick={() => setCancelModalQuote(null)} className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all cursor-pointer">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                                            <XCircle className="w-7 h-7 text-red-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white">Cancelar Orçamento</h3>
                                            <p className="text-sm font-bold text-white/40 uppercase tracking-widest mt-1">
                                                Ref: #{String(cancelModalQuote.id).substring(0, 8).toUpperCase()}
                                            </p>
                                        </div>
                                    </div>

                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (!cancelModalQuote) return;
                                        if (!cancelReason) {
                                            setToast({ msg: 'Selecione um motivo para o cancelamento.', type: 'error' });
                                            return;
                                        }
                                        if (cancelReason === 'outro' && !cancelReasonText.trim()) {
                                            setToast({ msg: 'Descreva o motivo do cancelamento.', type: 'error' });
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
                                                setToast({ msg: 'Orçamento cancelado.', type: 'success' });
                                                fetch('/api/quotes', { credentials: 'include' }).then(r => r.json()).then(setMyQuotes).catch(() => { });
                                                setCancelModalQuote(null);
                                            } else {
                                                const err = await res.json();
                                                setToast({ msg: err.error || 'Erro ao cancelar orçamento.', type: 'error' });
                                            }
                                        } catch (error) {
                                            setToast({ msg: 'Erro de comunicação com o servidor.', type: 'error' });
                                        } finally {
                                            setCanceling(false);
                                        }
                                    }} className="space-y-4 text-left">
                                        <div>
                                            <label className="text-xs font-bold text-white/50 uppercase ml-1 block mb-3 tracking-wider">Motivo do Cancelamento</label>
                                            <div className="space-y-2">
                                                {[
                                                    { id: 'cliente_desistiu', label: 'Cliente desistiu' },
                                                    { id: 'perdeu_concorrencia', label: 'Perdeu para concorrência' },
                                                    { id: 'preco_alto', label: 'Preço alto' },
                                                    { id: 'servico_adiado', label: 'Serviço adiado' },
                                                    { id: 'outro', label: 'Outro' }
                                                ].map(opt => (
                                                    <label key={opt.id} className="flex items-center p-3 border border-white/10 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                                                        <input type="radio" name="cancel_reason" value={opt.id} checked={cancelReason === opt.id} onChange={() => setCancelReason(opt.id)} className="w-4 h-4 text-red-500 border-white/20 focus:ring-red-500 bg-transparent" />
                                                        <span className="ml-3 text-sm font-medium text-white/90">{opt.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {cancelReason === 'outro' && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                                <label className="text-xs font-bold text-white/50 uppercase ml-1 block mb-2 tracking-wider mt-4">Descreva o motivo (obrigatório)</label>
                                                <textarea required value={cancelReasonText} onChange={e => setCancelReasonText(e.target.value)} rows={3}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-red-500/20 placeholder-white/20"
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

                    {/* ══ STEP 1: BENDS ══ */}
                    {
                        step === 'bends' && (!showMyQuotes || myQuotes.length === 0 || bends.length > 0) && (
                            <div className="space-y-6">
                                {/* Quick Client Create Modal (Redesigned) */}
                                {showQuickClient && (
                                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-end justify-center">
                                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                                            className="bg-white rounded-t-[3rem] p-8 w-full max-w-lg space-y-6 shadow-2xl relative">
                                            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-2" />
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-2xl font-black text-slate-900">Novo Cliente</h3>
                                                <button onClick={() => setShowQuickClient(false)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400"><X className="w-5 h-5" /></button>
                                            </div>
                                            <div className="space-y-5">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                                                    <input type="text" value={quickClientForm.name}
                                                        onChange={e => setQuickClientForm(p => ({ ...p, name: e.target.value }))}
                                                        placeholder="Nome do cliente"
                                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-6 py-4 text-slate-900 placeholder-slate-300 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all text-sm font-bold" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={quickClientForm.phone.startsWith('+') ? quickClientForm.phone.split(' ')[0] : '+55'}
                                                            onChange={e => {
                                                                const local = quickClientForm.phone.replace(/^\+\d+\s?/, '');
                                                                setQuickClientForm(p => ({ ...p, phone: `${e.target.value} ${local}`.trim() }));
                                                            }}
                                                            className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-3 py-4 text-slate-900 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all text-sm font-bold w-[90px] flex-shrink-0"
                                                        >
                                                            <option value="+55">+55 🇧🇷</option>
                                                            <option value="+1">+1 🇺🇸</option>
                                                            <option value="+44">+44 🇬🇧</option>
                                                            <option value="+351">+351 🇵🇹</option>
                                                            <option value="+54">+54 🇦🇷</option>
                                                            <option value="+595">+595 🇵🇾</option>
                                                            <option value="+598">+598 🇺🇾</option>
                                                            <option value="+56">+56 🇨🇱</option>
                                                            <option value="+57">+57 🇨🇴</option>
                                                        </select>
                                                        <input
                                                            type="text"
                                                            value={quickClientForm.phone.startsWith('+') ? quickClientForm.phone.replace(/^\+\d+\s?/, '') : quickClientForm.phone}
                                                            onChange={e => {
                                                                let val = e.target.value.replace(/\D/g, '');
                                                                if (val.length > 11) val = val.substring(0, 11);
                                                                let masked = val;
                                                                if (val.length > 2) masked = `(${val.substring(0, 2)}) ${val.substring(2)}`;
                                                                if (val.length > 6) masked = `(${val.substring(0, 2)}) ${val.substring(2, 6)}-${val.substring(6)}`;
                                                                if (val.length > 10) masked = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
                                                                const countryCode = quickClientForm.phone.startsWith('+') ? quickClientForm.phone.split(' ')[0] : '+55';
                                                                setQuickClientForm(p => ({ ...p, phone: `${countryCode} ${masked}`.trim() }));
                                                            }}
                                                            placeholder="(00) 00000-0000"
                                                            className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-2xl px-6 py-4 text-slate-900 placeholder-slate-300 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all text-sm font-bold" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail (opcional)</label>
                                                    <input type="email" value={quickClientForm.email}
                                                        onChange={e => setQuickClientForm(p => ({ ...p, email: e.target.value }))}
                                                        placeholder="cliente@email.com"
                                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-6 py-4 text-slate-900 placeholder-slate-300 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all text-sm font-bold" />
                                                </div>
                                            </div>
                                            <button disabled={quickClientSaving}
                                                onClick={async () => {
                                                    if (!quickClientForm.name.trim() || !quickClientForm.phone.trim()) {
                                                        setToast({ msg: 'Nome e Telefone são obrigatórios', type: 'error' }); return;
                                                    }
                                                    setQuickClientSaving(true);
                                                    try {
                                                        const res = await fetch('/api/clients', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            credentials: 'include',
                                                            body: JSON.stringify(quickClientForm),
                                                        });
                                                        if (!res.ok) throw new Error((await res.json()).error);
                                                        const newClient = await res.json();
                                                        setAllClients(p => [...p, newClient]);
                                                        setSelectedClientId(newClient.id);
                                                        setClientName(newClient.name);
                                                        setClientSearch(newClient.name);
                                                        setShowQuickClient(false);
                                                        setQuickClientForm({ name: '', phone: '', email: '' });
                                                        setToast({ msg: 'Cliente cadastrado!', type: 'success' });
                                                    } catch (err: any) {
                                                        setToast({ msg: err.message || 'Erro ao criar cliente', type: 'error' });
                                                    } finally { setQuickClientSaving(false); }
                                                }}
                                                className="w-full py-5 bg-brand-primary text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all uppercase tracking-widest text-xs">
                                                {quickClientSaving ? 'Salvando...' : 'Salvar e Selecionar'}
                                            </button>
                                            <div className="pb-4" />
                                        </motion.div>
                                    </div>
                                )}

                                {/* Client name input + Product selector (Redesigned) */}
                                <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl space-y-8 border border-slate-100">
                                    <div className="flex flex-col gap-6">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <h2 className="text-2xl font-black text-slate-900 leading-tight">Setup do Orçamento</h2>
                                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Identificação e Materiais</p>
                                            </div>
                                            <button onClick={() => {
                                                if (currentRisks.length > 0 || bends.length > 0) {
                                                    if (!window.confirm('Deseja descartar e voltar à listagem?')) return;
                                                }
                                                setShowMyQuotes(true); setBends([]); setCurrentRisks([]);
                                            }}
                                                className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center active:scale-95 transition-all">
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>
                                        </div>

                                        {/* Client autocomplete */}
                                        <div className="relative group">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Cliente</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={clientSearch}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setClientSearch(val);
                                                        setClientName(val);
                                                        setSelectedClientId(null);
                                                        setShowClientDropdown(true);
                                                    }}
                                                    onFocus={() => setShowClientDropdown(true)}
                                                    placeholder="Nome do cliente ou buscar..."
                                                    className="w-full bg-slate-50 border-2 border-blue-500/20 rounded-2xl px-6 py-4 text-slate-900 placeholder-slate-300 font-bold focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all outline-none"
                                                />
                                                {selectedClientId && (
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-green-500 rounded-full p-1 shadow-lg">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            {/* Dropdown */}
                                            <AnimatePresence>
                                                {showClientDropdown && clientSearch.length > 0 && (
                                                    <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-3xl z-50 shadow-2xl overflow-hidden">
                                                        <div className="max-h-60 overflow-y-auto">
                                                            {allClients.filter(c =>
                                                                c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                                                c.phone?.includes(clientSearch)
                                                            ).map(c => (
                                                                <button key={c.id}
                                                                    onMouseDown={e => e.preventDefault()}
                                                                    onClick={() => {
                                                                        setSelectedClientId(c.id);
                                                                        setClientName(c.name);
                                                                        setClientSearch(c.name);
                                                                        setShowClientDropdown(false);
                                                                    }}
                                                                    className="w-full text-left px-6 py-4 hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-none">
                                                                    <div className="space-y-0.5">
                                                                        <p className="text-slate-900 font-bold text-sm">{c.name}</p>
                                                                        <p className="text-slate-400 text-[10px] font-mono">{c.phone}</p>
                                                                    </div>
                                                                    <ChevronRight className="w-4 h-4 text-slate-200" />
                                                                </button>
                                                            ))}
                                                            {allClients.filter(c =>
                                                                c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                                                c.phone?.includes(clientSearch)
                                                            ).length === 0 && (
                                                                    <div className="px-6 py-5 space-y-3">
                                                                        <p className="text-slate-400 text-xs font-medium">Nenhum cliente encontrado.</p>
                                                                        <button onClick={() => { setShowClientDropdown(false); setShowQuickClient(true); setQuickClientForm({ name: clientSearch, phone: '+55 ', email: '' }); }}
                                                                            className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                                                                            <Plus className="w-3.5 h-3.5" /> Cadastrar "{clientSearch}"
                                                                        </button>
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Product selector */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto / Calha</label>
                                                {!selectedProductId && (
                                                    <span className="text-[10px] font-black text-amber-500 uppercase animate-pulse">Obrigatório</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {allProducts.map(p => {
                                                        const isSvc = p.type_product === 'service' || p.tipo_produto === 'service';
                                                        return (
                                                            <button key={p.id}
                                                                onClick={() => {
                                                                    setSelectedProductId(p.id);
                                                                    setSelectedProductName(p.name);
                                                                    const pType = p.type_product || p.tipo_produto || 'product';
                                                                    setSelectedProductType(pType);
                                                                    if (pType === 'service') {
                                                                        setServiceDescription(p.description || p.name);
                                                                        setServiceValue(String(p.price || p.base_cost || ''));
                                                                        setServiceQty('1');
                                                                        setTimeout(() => serviceDescRef.current?.focus(), 100);
                                                                    }
                                                                }}
                                                                className={`flex-1 min-w-[140px] px-6 py-4 rounded-2xl border-2 font-black text-xs transition-all flex items-center justify-between
                                                                ${selectedProductId === p.id
                                                                        ? (isSvc ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-blue-500/20')
                                                                        : (isSvc ? 'bg-white border-purple-500/30 text-purple-600' : 'bg-white border-blue-500/30 text-blue-600 hover:border-blue-500')
                                                                    }`}>
                                                                <span>{p.name}</span>
                                                                {selectedProductId === p.id && <Check className="w-4 h-4" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <button onClick={() => { setShowQuickService(true); setQuickServiceForm({ name: '', description: '', price: '', stock_quantity: '', unit: 'un', type_product: 'product' }); }}
                                                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:bg-slate-50 transition-all">
                                                    <Plus className="w-4 h-4" /> Novo Produto
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Grouping Toggle (Redesigned) */}
                                {bends.length === 0 && selectedProductType !== 'service' && (
                                    <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100 flex items-center justify-between">
                                        <div className="flex gap-4 items-center">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${groupByRoom ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                                                <GitBranch className="w-6 h-6" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-black text-slate-900 leading-tight">Agrupar por Cômodo</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Organização de dobras</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setGroupByRoom(v => !v); setCurrentGroupName(''); setLastGroupName(''); }}
                                            className={`relative w-14 h-8 rounded-full transition-all flex-shrink-0 ${groupByRoom ? 'bg-brand-primary shadow-lg shadow-blue-500/30' : 'bg-slate-100'}`}
                                        >
                                            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all ${groupByRoom ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>
                                )}

                                {/* Group Input (Redesigned) */}
                                {groupByRoom && selectedProductType !== 'service' && (
                                    <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100 space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Localização / Cômodo</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {Array.from(new Set(bends.map(b => b.group_name).filter(Boolean))).map(g => (
                                                <button key={g}
                                                    onClick={() => setCurrentGroupName(g || '')}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all
                                                    ${currentGroupName === g
                                                            ? 'bg-blue-50 border-brand-primary text-brand-primary'
                                                            : 'bg-slate-50 border-slate-50 text-slate-400'
                                                        }`}
                                                >{g}</button>
                                            ))}
                                            <input
                                                type="text"
                                                placeholder="Ex: QUARTO, SALA..."
                                                value={currentGroupName}
                                                onChange={e => setCurrentGroupName(e.target.value.toUpperCase())}
                                                className="flex-1 min-w-[120px] bg-slate-50 border-none rounded-2xl px-5 py-3 text-xs font-black text-slate-900 placeholder-slate-300 outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Quick Product/Service Create Modal */}
                                {showQuickService && (
                                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                                        <div className="bg-slate-800 border border-white/15 rounded-3xl p-7 w-full max-w-lg shadow-2xl space-y-5">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-white font-bold text-xl">Novo Produto / Serviço</h3>
                                                <button onClick={() => setShowQuickService(false)} className="text-white/50 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
                                            </div>

                                            {/* Type selector */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <button type="button"
                                                    onClick={() => setQuickServiceForm(f => ({ ...f, type_product: 'product' }))}
                                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold border-2 transition-all cursor-pointer ${quickServiceForm.type_product === 'product'
                                                        ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                                                        : 'bg-white/5 border-white/15 text-slate-300 hover:border-blue-400'
                                                        }`}>
                                                    📦 Produto (Calha)
                                                </button>
                                                <button type="button"
                                                    onClick={() => setQuickServiceForm(f => ({ ...f, type_product: 'service' }))}
                                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold border-2 transition-all cursor-pointer ${quickServiceForm.type_product === 'service'
                                                        ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/30'
                                                        : 'bg-white/5 border-white/15 text-slate-300 hover:border-purple-400'
                                                        }`}>
                                                    🛠 Serviço
                                                </button>
                                            </div>

                                            {/* Name */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-400 uppercase">{quickServiceForm.type_product === 'service' ? 'Nome do Serviço *' : 'Nome do Produto *'}</label>
                                                <input type="text"
                                                    value={quickServiceForm.name}
                                                    onChange={e => setQuickServiceForm(f => ({ ...f, name: e.target.value }))}
                                                    placeholder={quickServiceForm.type_product === 'service' ? 'Ex: Instalação, Limpeza...' : 'Ex: Calha Zinco Quadrada'}
                                                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-all" />
                                            </div>

                                            {/* Description */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-400 uppercase">Descrição (Opcional)</label>
                                                <input type="text"
                                                    value={quickServiceForm.description}
                                                    onChange={e => setQuickServiceForm(f => ({ ...f, description: e.target.value }))}
                                                    placeholder="Descrição detalhada..."
                                                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-all" />
                                            </div>

                                            {/* Price + Unit/Stock */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-slate-400 uppercase">{quickServiceForm.type_product === 'service' ? 'Valor Padrão (R$)' : 'Preço (R$)'}</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                                                        <input type="number" min="0" step="0.01"
                                                            value={quickServiceForm.price}
                                                            onChange={e => setQuickServiceForm(f => ({ ...f, price: e.target.value }))}
                                                            placeholder="0,00"
                                                            className="w-full bg-white/5 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-all" />
                                                    </div>
                                                </div>
                                                {quickServiceForm.type_product === 'product' ? (
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-400 uppercase">Estoque (m²)</label>
                                                        <input type="number" min="0" step="0.01"
                                                            value={quickServiceForm.stock_quantity}
                                                            onChange={e => setQuickServiceForm(f => ({ ...f, stock_quantity: e.target.value }))}
                                                            placeholder="0.00"
                                                            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-all" />
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-400 uppercase">Unidade</label>
                                                        <select value={quickServiceForm.unit}
                                                            onChange={e => setQuickServiceForm(f => ({ ...f, unit: e.target.value }))}
                                                            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-400 transition-all">
                                                            <option value="un">Unidade</option>
                                                            <option value="m">Metro</option>
                                                            <option value="m2">m²</option>
                                                            <option value="hr">Hora</option>
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            {quickServiceForm.type_product === 'service' && (
                                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-sm text-purple-300">
                                                    💡 <strong>Serviço:</strong> Na tela de orçamento, o sistema pedirá a descrição e o valor sem medições de dobras.
                                                </div>
                                            )}

                                            <div className="flex gap-3 pt-1">
                                                <button onClick={() => setShowQuickService(false)}
                                                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl cursor-pointer transition-colors">Cancelar</button>
                                                <button disabled={quickServiceSaving}
                                                    onClick={async () => {
                                                        if (!quickServiceForm.name.trim()) {
                                                            setToast({ msg: 'Nome é obrigatório', type: 'error' }); return;
                                                        }
                                                        setQuickServiceSaving(true);
                                                        try {
                                                            const res = await fetch('/api/products', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                credentials: 'include',
                                                                body: JSON.stringify({
                                                                    name: quickServiceForm.name.trim(),
                                                                    description: quickServiceForm.description.trim() || quickServiceForm.name.trim(),
                                                                    price: parseFloat(quickServiceForm.price) || 0,
                                                                    type_product: quickServiceForm.type_product,
                                                                    stock_quantity: quickServiceForm.type_product === 'product' ? (parseFloat(quickServiceForm.stock_quantity) || 0) : 0,
                                                                    unit: quickServiceForm.unit,
                                                                }),
                                                            });
                                                            if (!res.ok) throw new Error((await res.json()).error);
                                                            const newItem = await res.json();
                                                            setAllProducts(p => [...p, newItem]);
                                                            // Auto-select
                                                            setSelectedProductId(newItem.id);
                                                            setSelectedProductName(newItem.name);
                                                            const isService = quickServiceForm.type_product === 'service';
                                                            setSelectedProductType(isService ? 'service' : 'product');
                                                            if (isService) {
                                                                setServiceDescription(newItem.description || newItem.name);
                                                                setServiceValue(String(newItem.price || ''));
                                                                setServiceQty('1');
                                                                setTimeout(() => serviceDescRef.current?.focus(), 200);
                                                            }
                                                            setShowQuickService(false);
                                                            setQuickServiceForm({ name: '', description: '', price: '', stock_quantity: '', unit: 'un', type_product: 'product' });
                                                            setToast({ msg: `${isService ? 'Serviço' : 'Produto'} cadastrado e selecionado!`, type: 'success' });
                                                        } catch (err: any) {
                                                            setToast({ msg: err.message || 'Erro ao criar', type: 'error' });
                                                        } finally { setQuickServiceSaving(false); }
                                                    }}
                                                    className={`flex-1 py-3 font-bold rounded-xl cursor-pointer disabled:opacity-50 transition-colors ${quickServiceForm.type_product === 'service'
                                                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                                                        }`}>
                                                    {quickServiceSaving ? 'Salvando...' : `Cadastrar e Selecionar`}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Builder / Service Form (Redesigned) */}
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                    className={`bg-white rounded-[3rem] p-8 space-y-8 shadow-2xl border border-slate-100 transition-colors ${selectedProductType === 'service' ? 'ring-4 ring-purple-100' : ''}`}>

                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <h2 className="text-2xl font-black text-slate-900 leading-tight">
                                                {selectedProductType === 'service' ? 'Detalhes do Serviço' : `Dobra #${bends.length + 1}`}
                                            </h2>
                                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none">
                                                {selectedProductType === 'service' ? 'Execução e Mão de Obra' : 'Configuração de Corte'}
                                            </p>
                                        </div>
                                        {selectedProductType === 'product' && selectedProductId && (
                                            <button onClick={() => setShowLibrary(v => !v)}
                                                className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center active:scale-95 transition-all">
                                                <List className="w-6 h-6" />
                                            </button>
                                        )}
                                    </div>

                                    {selectedProductType === 'service' ? (
                                        <div className="space-y-6 pt-2">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                                                <textarea
                                                    ref={serviceDescRef}
                                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-bold placeholder-slate-300 outline-none focus:ring-4 focus:ring-purple-100 transition-all min-h-[120px]"
                                                    placeholder="Descreva o serviço..."
                                                    value={serviceDescription}
                                                    onChange={e => setServiceDescription(e.target.value)}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Unitário</label>
                                                    <div className="relative">
                                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-black">R$</span>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-slate-900 font-black focus:ring-4 focus:ring-purple-100 outline-none"
                                                            placeholder="0,00"
                                                            value={serviceValue}
                                                            onChange={e => setServiceValue(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Qtd</label>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black focus:ring-4 focus:ring-purple-100 outline-none"
                                                        value={serviceQty}
                                                        onChange={e => setServiceQty(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="bg-purple-50 rounded-[2rem] p-6 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Subtotal</p>
                                                    <h3 className="text-2xl font-black text-purple-600">
                                                        {fmt(((parseFloat(serviceValue) || 0) * (parseFloat(serviceQty) || 0)))}
                                                    </h3>
                                                </div>
                                                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                                                    <Save className="w-6 h-6" />
                                                </div>
                                            </div>

                                            <button onClick={handleConfirmService} disabled={!serviceDescription || !serviceValue}
                                                className="w-full py-5 bg-purple-600 text-white font-black rounded-2xl shadow-xl shadow-purple-200 active:scale-95 transition-all uppercase tracking-widest text-xs">
                                                Confirmar Serviço
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Bend library suggestions */}
                                            <AnimatePresence>
                                                {showLibrary && (
                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                        className="bg-white/5 rounded-2xl p-4 space-y-2 overflow-hidden">
                                                        <p className="text-xs text-slate-400 uppercase tracking-wider">
                                                            Dobras salvas para este produto — clique para carregar:
                                                        </p>
                                                        {bendLibraryLoading ? (
                                                            <p className="text-slate-400 text-sm py-2 flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Carregando dobras...</p>
                                                        ) : bendLibrary.length === 0 ? (
                                                            <p className="text-slate-500 text-sm py-2">Nenhuma dobra salva para este produto ainda. Crie uma dobra e ela aparecerá aqui.</p>
                                                        ) : (
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 pr-2" style={{ maxHeight: '30vh', overflowY: 'auto' }}>
                                                                {bendLibrary.map((b, i) => (
                                                                    <div key={i} className="flex">
                                                                        <button onClick={() => { setCurrentRisks(b.risks); setShowLibrary(false); }}
                                                                            className="flex-1 flex flex-col items-center gap-1.5 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer border border-white/10 text-center w-full">
                                                                            {b.svgDataUrl && <img src={b.svgDataUrl} alt="" className="w-full h-12 rounded object-contain" style={{ background: '#1e293b' }} />}
                                                                            <div className="text-[10px] sm:text-xs">
                                                                                <span className="block truncate w-full">{b.risks.map(r => `${DIRECTION_ICONS[r.direction]}${r.sizeCm}`).join(' ')}</span>
                                                                                <span className="text-blue-400 font-bold ml-1">{b.roundedWidthCm}</span>
                                                                                {b.useCount > 1 && <span className="ml-1 text-white/40">×{b.useCount}</span>}
                                                                            </div>
                                                                        </button>
                                                                        {b.svgDataUrl && (
                                                                            <button onClick={() => setLibraryZoom(b)}
                                                                                className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer" title="Ampliar">
                                                                                <ZoomIn className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Canvas */}
                                            <BendCanvas
                                                risks={currentRisks}
                                                svgRef={svgRef}
                                            />

                                            {/* Width info */}
                                            <div className="flex gap-3 flex-wrap text-sm">
                                                <div className={`px-4 py-2 rounded-xl font-bold ${isOver ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white'}`}>
                                                    Soma: <strong>{curWidth.toFixed(2)}</strong>
                                                </div>
                                                {!isOver && curWidth > 0 && (
                                                    <div className="px-4 py-2 rounded-xl font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                        Arredondado: <strong>{curRounded.toFixed(2)}</strong>
                                                    </div>
                                                )}
                                                {isOver && <div className="flex items-center gap-2 text-red-400 font-bold"><AlertTriangle className="w-4 h-4" /> Excede 120 cm!</div>}
                                            </div>

                                            {/* DIRECTION & MODIFIERS COMPACT LAYOUT */}
                                            <div className="flex flex-col gap-6 mt-4">
                                                {/* Step 1 & 2 Together for Mobile */}
                                                <div className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-5 space-y-4 shadow-inner">
                                                    <div className="flex items-center justify-between px-1">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Passo 1 & 2 — Direção e Medida</p>
                                                        {sizeError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-tight animate-bounce">{sizeError}</p>}
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-3 w-full">
                                                        {[DIR_GRID[0], DIR_GRID[1], DIR_GRID[2]].map(d => <DirBtn key={d.dir} d={d} active={pendingDir === d.dir} onClick={() => selectDirection(d.dir)} />)}
                                                        <DirBtn key="left" d={DIR_GRID[3]} active={pendingDir === 'left'} onClick={() => selectDirection('left')} />

                                                        {/* Integrated Size Input */}
                                                        <div className="relative group flex items-center justify-center">
                                                            <input
                                                                ref={sizeInputRef}
                                                                type="number"
                                                                step="0.5"
                                                                placeholder="cm"
                                                                value={pendingSize}
                                                                onChange={e => setPendingSize(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && handleAddRisk()}
                                                                className="w-full aspect-square bg-white border-2 border-brand-primary/30 rounded-2xl text-center text-lg font-black text-slate-900 placeholder-slate-200 outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary transition-all p-0"
                                                            />
                                                            {pendingSize && (
                                                                <button
                                                                    onClick={handleAddRisk}
                                                                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-lg active:scale-75 transition-all"
                                                                >
                                                                    <Plus className="w-4 h-4 pointer-events-none" />
                                                                </button>
                                                            )}
                                                        </div>

                                                        <DirBtn key="right" d={DIR_GRID[4]} active={pendingDir === 'right'} onClick={() => selectDirection('right')} />
                                                        {[DIR_GRID[5], DIR_GRID[6], DIR_GRID[7]].map(d => <DirBtn key={d.dir} d={d} active={pendingDir === d.dir} onClick={() => selectDirection(d.dir)} />)}
                                                    </div>
                                                </div>

                                                {/* Modifiers & Size Input (Redesigned) */}
                                                <div className="flex-1 space-y-8">
                                                    <div className="space-y-4">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modificadores</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            <button onClick={() => setIsAngle(!isAngle)} disabled={!pendingDir}
                                                                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border-2
                                                            ${isAngle ? 'bg-amber-50 border-amber-500 text-amber-600 shadow-lg shadow-amber-500/10' : 'bg-white border-slate-100 text-slate-400'}`}>
                                                                <RotateCcw className="w-4 h-4" /> Ângulo
                                                            </button>
                                                            <button onClick={() => { if (isLateralSlope) { setSlopeH1(''); setSlopeH2(''); } setIsLateralSlope(!isLateralSlope); }}
                                                                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border-2
                                                            ${isLateralSlope ? 'bg-indigo-50 border-indigo-500 text-indigo-600 shadow-lg shadow-indigo-500/10' : 'bg-white border-slate-100 text-slate-400'}`}>
                                                                <Triangle className="w-4 h-4" /> Caída
                                                            </button>
                                                        </div>

                                                        <AnimatePresence>
                                                            {(isAngle || isLateralSlope) && (
                                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                                    className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5 space-y-4 overflow-hidden">
                                                                    {isAngle && (
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-slate-400 uppercase">Ângulo (º)</span>
                                                                            <div className="flex items-center gap-2">
                                                                                <input type="number" placeholder="45" value={pendingAngle} onChange={e => setPendingAngle(e.target.value)}
                                                                                    className="w-20 bg-white border-none rounded-xl px-4 py-2 text-center font-black text-slate-900 outline-none shadow-sm" />
                                                                                <span className="text-slate-300 font-bold">°</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {isLateralSlope && (
                                                                        <div className="space-y-4">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase">Lado</span>
                                                                                <div className="flex bg-white rounded-xl p-1 shadow-sm">
                                                                                    {(['D', 'E'] as const).map(s => (
                                                                                        <button key={s} onClick={() => setSlopeSide(s)}
                                                                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${slopeSide === s ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
                                                                                            {s === 'D' ? 'DIR' : 'ESQ'}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-3">
                                                                                <div className="space-y-2">
                                                                                    <span className="text-[8px] font-black text-slate-400 uppercase ml-1">H1</span>
                                                                                    <input type="number" step="0.1" placeholder="0.0" value={slopeH1} onChange={e => setSlopeH1(e.target.value)}
                                                                                        className="w-full bg-white border-none rounded-xl px-4 py-2 text-center font-black text-slate-900 outline-none shadow-sm" />
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                    <span className="text-[8px] font-black text-slate-400 uppercase ml-1">H2</span>
                                                                                    <input type="number" step="0.1" placeholder="0.0" value={slopeH2} onChange={e => setSlopeH2(e.target.value)}
                                                                                        className="w-full bg-white border-none rounded-xl px-4 py-2 text-center font-black text-slate-900 outline-none shadow-sm" />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medida da Aba (cm)</p>
                                                        <div className="flex gap-2">
                                                            <input ref={sizeInputRef} type="number" min="1" max="120" step="0.5"
                                                                placeholder={isLateralSlope ? "Calculado" : "0.00"}
                                                                value={isLateralSlope ? "" : pendingSize} onChange={e => { setPendingSize(e.target.value); setSizeError(''); }}
                                                                onKeyDown={e => e.key === 'Enter' && handleAddRisk()}
                                                                disabled={!pendingDir || isLateralSlope}
                                                                className="flex-1 bg-slate-50 border-none rounded-[1.5rem] px-6 py-5 text-2xl font-black text-slate-900 placeholder-slate-200 outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all text-center" />

                                                            <button onClick={handleAddRisk} disabled={!pendingDir || (!pendingSize && !isLateralSlope)}
                                                                className="w-20 bg-brand-primary text-white rounded-[1.5rem] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30">
                                                                <Plus className="w-8 h-8" />
                                                            </button>
                                                        </div>
                                                        {sizeError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-tight text-center animate-bounce">{sizeError}</p>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Risks list */}
                                            {currentRisks.length > 0 && (
                                                <div className="mt-6 border-t border-white/5 pt-5">
                                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Riscos — clique na seta para mudar direção, no valor para editar cm:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {currentRisks.map((r, i) => (
                                                            <div key={i} className="relative flex items-center gap-1 px-3 py-1.5 bg-white/10 rounded-xl border border-white/20">
                                                                {/* Direction edit */}
                                                                <button onClick={() => setEditDirIdx(editDirIdx === i ? null : i)}
                                                                    className="text-white hover:text-yellow-300 transition-colors cursor-pointer text-base" title="Editar direção">
                                                                    {DIRECTION_ICONS[r.direction]}
                                                                </button>
                                                                {editDirIdx === i && (
                                                                    <div className="absolute top-9 left-0 z-50 bg-slate-800 border border-white/20 rounded-xl p-2 grid grid-cols-3 gap-1 shadow-xl w-32">
                                                                        {DIR_GRID.map(d => (
                                                                            <button key={d.dir} onClick={() => commitEditDir(i, d.dir)}
                                                                                className={`text-lg p-1.5 rounded-lg transition-all cursor-pointer ${r.direction === d.dir ? 'bg-blue-500' : 'hover:bg-white/10'}`}>
                                                                                {d.icon}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {/* Size edit */}
                                                                {r.slopeData ? (
                                                                    editingSlopeIdx === i ? (
                                                                        <div className="flex items-center gap-2 bg-slate-900/80 rounded-xl p-2 border border-amber-500/50 shadow-inner">
                                                                            <div className="flex bg-slate-800 rounded-lg overflow-hidden border border-white/10">
                                                                                {(['D', 'E'] as const).map(s => (
                                                                                    <button key={s} onClick={(e) => { e.stopPropagation(); setEditSlopeSide(s); }}
                                                                                        className={`px-2 py-1 text-[10px] font-black transition-all cursor-pointer ${editSlopeSide === s ? 'bg-amber-500 text-white' : 'text-white/40 hover:text-white'}`}>
                                                                                        {s}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                            <div className="flex items-center gap-1">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[8px] text-amber-500/70 font-bold uppercase ml-1">H1</span>
                                                                                    <input type="number" autoFocus step="0.1" value={editSlopeH1}
                                                                                        onChange={e => setEditSlopeH1(e.target.value)}
                                                                                        className="w-12 bg-white/10 text-white text-xs font-bold px-2 py-1 rounded-lg outline-none border border-white/10 focus:border-amber-500/50" />
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[8px] text-amber-500/70 font-bold uppercase ml-1">H2</span>
                                                                                    <input type="number" step="0.1" value={editSlopeH2}
                                                                                        onChange={e => setEditSlopeH2(e.target.value)}
                                                                                        onBlur={() => commitEditSlope(i)}
                                                                                        onKeyDown={e => { if (e.key === 'Enter') commitEditSlope(i); if (e.key === 'Escape') setEditingSlopeIdx(null); }}
                                                                                        className="w-12 bg-white/10 text-white text-xs font-bold px-2 py-1 rounded-lg outline-none border border-white/10 focus:border-amber-500/50" />
                                                                                </div>
                                                                                <button onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    ignoreSizeBlurRef.current = true;
                                                                                    const h1 = parseFloat(editSlopeH1) || r.sizeCm;
                                                                                    const h2 = parseFloat(editSlopeH2) || r.sizeCm;
                                                                                    const newSize = Math.max(h1, h2);

                                                                                    setCurrentRisks(prev => {
                                                                                        const next = [...prev];
                                                                                        next[i] = { ...next[i], slopeData: undefined, sizeCm: newSize };
                                                                                        return next;
                                                                                    });
                                                                                    setEditingSlopeIdx(null);
                                                                                    setEditSizeIdx(i);
                                                                                    setEditSizeVal(String(newSize));
                                                                                }}
                                                                                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-[10px] font-bold transition-all border border-slate-600 flex items-center gap-1 cursor-pointer" title="Converter para Linha Normal">
                                                                                    <Undo2 className="w-3 h-3" /> Normal
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={(e) => { e.stopPropagation(); setEditingSlopeIdx(i); setEditSlopeH1(String(r.slopeData!.h1)); setEditSlopeH2(String(r.slopeData!.h2)); setEditSlopeSide(r.slopeData!.side); }}
                                                                            className="text-amber-400 font-black text-sm hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1" title="Editar caída">
                                                                            <PenLine className="w-3 h-3 opacity-50" />
                                                                            <span className="bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                                                                                {r.slopeData!.side} {r.slopeData!.h1}/{r.slopeData!.h2}
                                                                            </span>
                                                                        </button>
                                                                    )
                                                                ) : (
                                                                    editSizeIdx === i ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <input type="number" autoFocus value={editSizeVal}
                                                                                onChange={e => setEditSizeVal(e.target.value)}
                                                                                onBlur={() => commitEditSize(i)}
                                                                                onKeyDown={e => { if (e.key === 'Enter') commitEditSize(i); if (e.key === 'Escape') setEditSizeIdx(null); }}
                                                                                className="w-16 bg-white/20 text-white text-sm font-bold rounded px-2 py-0.5 outline-none border border-blue-400" />
                                                                            <button onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                ignoreSizeBlurRef.current = true;
                                                                                const h = String(r.sizeCm);
                                                                                setCurrentRisks(prev => {
                                                                                    const next = [...prev];
                                                                                    next[i] = { ...next[i], slopeData: { h1: r.sizeCm, h2: r.sizeCm, side: 'D' } };
                                                                                    return next;
                                                                                });
                                                                                setEditSizeIdx(null);
                                                                                setEditingSlopeIdx(i);
                                                                                setEditSlopeH1(h);
                                                                                setEditSlopeH2(h);
                                                                                setEditSlopeSide('D');
                                                                                setTimeout(() => ignoreSizeBlurRef.current = false, 200);
                                                                            }} className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500 text-amber-500 hover:text-white text-[10px] rounded flex gap-1 items-center font-bold transition-all border border-amber-500/30" title="Mudar para Caída Lateral"><Triangle className="w-3 h-3" /> Caída</button>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={() => { setEditSizeIdx(i); setEditSizeVal(String(r.sizeCm)); }}
                                                                            className="text-white font-bold text-sm hover:text-blue-300 transition-colors cursor-pointer" title="Editar cm">
                                                                            <PenLine className="w-3 h-3 inline mr-0.5 opacity-50" />{r.sizeCm}
                                                                        </button>
                                                                    )
                                                                )}

                                                                {/* Angle Edit */}
                                                                {editingAngleIdx === i ? (
                                                                    <div className="flex items-center ml-2 border border-amber-500 rounded px-1 max-w-[80px]">
                                                                        <span className="text-amber-500 text-xs">∠</span>
                                                                        <input type="number" autoFocus value={editAngleVal}
                                                                            onChange={e => setEditAngleVal(e.target.value)}
                                                                            onBlur={() => commitEditAngle(i)}
                                                                            onKeyDown={e => { if (e.key === 'Enter') commitEditAngle(i); if (e.key === 'Escape') setEditingAngleIdx(null); }}
                                                                            className="w-10 bg-transparent text-amber-300 text-xs font-bold px-1 outline-none" />
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() => { setEditingAngleIdx(i); setEditAngleVal(r.angle != null ? String(r.angle) : ''); }}
                                                                        className="text-amber-500/80 font-bold text-xs hover:text-amber-300 transition-colors cursor-pointer flex items-center ml-2" title="Editar ângulo">
                                                                        {r.angle != null ? `∠ ${r.angle}°` : `∠ +`}
                                                                    </button>
                                                                )}

                                                                <button onClick={() => setCurrentRisks(prev => prev.filter((_, idx) => idx !== i))}
                                                                    className="text-red-400/60 hover:text-red-400 transition-colors cursor-pointer ml-1">
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action: Add to Quote (Redesigned) */}
                                            <div className="flex flex-col gap-3">
                                                {currentRisks.length > 0 && (
                                                    <button onClick={() => setCurrentRisks(prev => prev.slice(0, -1))}
                                                        className="w-full py-4 border-2 border-rose-50 rounded-2xl text-rose-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:bg-rose-50 transition-all">
                                                        <RotateCcw className="w-4 h-4" /> Apagar Último Risco
                                                    </button>
                                                )}
                                                <button onClick={handleConfirmBend} disabled={!currentRisks.length || isOver}
                                                    className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30">
                                                    <Check className="w-5 h-5" /> Adicionar ao Orçamento
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </motion.div>

                                {/* Confirmed bends with meters input (Step 1) */}
                                {bends.length > 0 && (
                                    <div className="space-y-4 pt-4" ref={metersRef}>
                                        <div className="flex items-center justify-between px-2">
                                            <h3 className="text-white font-black text-xs uppercase tracking-widest opacity-60">Itens do Orçamento ({bends.length})</h3>
                                        </div>

                                        <div className="space-y-4">
                                            {bends.map((bend, bi) => {
                                                const isService = bend.productType === 'service';
                                                const pCount = bends.filter((b, idx) => idx < bi && b.productType !== 'service').length + 1;
                                                const sCount = bends.filter((b, idx) => idx < bi && b.productType === 'service').length + 1;
                                                const label = isService ? `Serviço #${sCount}` : `Dobra #${pCount}`;

                                                return (
                                                    <motion.div
                                                        key={bend.id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="bg-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden active:scale-[0.99] transition-all"
                                                    >
                                                        {/* Header Piece Info */}
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black ${isService ? 'bg-purple-500 shadow-lg shadow-purple-500/20' : 'bg-brand-primary shadow-lg shadow-brand-primary/20'}`}>
                                                                    {bi + 1}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-slate-900 font-black text-base">{label}</span>
                                                                        {bend.group_name && (
                                                                            <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border border-slate-200">
                                                                                {bend.group_name}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                                                        {isService ? 'Serviço Adicional' : `${bend.totalWidthCm.toFixed(1)}cm → ${bend.roundedWidthCm}cm`}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => { setChangingGroupId(bend.id); setTempGroupName(bend.group_name || ''); }}
                                                                    className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl active:bg-slate-100 transition-all border border-slate-100"
                                                                >
                                                                    <List className="w-5 h-5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setBends(prev => prev.filter(b => b.id !== bend.id))}
                                                                    className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl active:bg-rose-500 active:text-white transition-all border border-rose-100"
                                                                >
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Group Editor Inline (Mobile Native Feel) */}
                                                        <AnimatePresence>
                                                            {changingGroupId === bend.id && (
                                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4">
                                                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase">Mover para qual grupo?</p>
                                                                        <div className="flex gap-2 flex-wrap">
                                                                            {Array.from(new Set(bends.map(b => b.group_name).filter(Boolean))).map(g => (
                                                                                <button key={g} onClick={() => {
                                                                                    setBends(prev => prev.map(b => b.id === bend.id ? { ...b, group_name: g } : b));
                                                                                    setChangingGroupId(null);
                                                                                }} className="px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-bold active:bg-slate-100 transition-colors">
                                                                                    {g}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <input type="text" placeholder="Novo nome..." value={tempGroupName} onChange={e => setTempGroupName(e.target.value)}
                                                                                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                                                                            <button onClick={() => {
                                                                                setBends(prev => prev.map(b => b.id === bend.id ? { ...b, group_name: tempGroupName.trim() || undefined } : b));
                                                                                setChangingGroupId(null);
                                                                            }} className="px-4 py-2 bg-brand-primary text-white font-black rounded-xl text-xs uppercase">Ok</button>
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>

                                                        {/* Piece Content */}
                                                        {isService ? (
                                                            <div className="space-y-4">
                                                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                                    <p className="text-slate-600 font-medium text-sm leading-relaxed">{bend.serviceDescription}</p>
                                                                </div>

                                                                <div className="flex gap-4">
                                                                    <div className="flex-1 bg-slate-50 rounded-2xl p-3 flex flex-col items-center border border-slate-100">
                                                                        <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Qtd/Unid</span>
                                                                        <span className="text-lg font-black text-slate-900">{bend.serviceQty}x</span>
                                                                    </div>
                                                                    <div className="flex-[2] bg-purple-50 rounded-2xl p-3 flex flex-col items-center border border-purple-100">
                                                                        <span className="text-[9px] font-black text-purple-400 uppercase mb-1">Valor do Serviço</span>
                                                                        <span className="text-xl font-black text-purple-700">{fmt((bend.serviceValue || 0) * (bend.serviceQty || 1))}</span>
                                                                    </div>
                                                                </div>

                                                                <button onClick={() => {
                                                                    setEditingServiceId(bend.id);
                                                                    setEditServiceDesc(bend.serviceDescription || '');
                                                                    setEditServiceVal(String(bend.serviceValue || ''));
                                                                    setEditServiceQtyStr(String(bend.serviceQty || 1));
                                                                }} className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
                                                                    <PenLine className="w-4 h-4" /> Editar Detalhes
                                                                </button>

                                                                <AnimatePresence>
                                                                    {editingServiceId === bend.id && (
                                                                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                                                                            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
                                                                                <h3 className="text-xl font-black text-slate-900">Editar Serviço</h3>
                                                                                <textarea rows={3} value={editServiceDesc} onChange={e => setEditServiceDesc(e.target.value)}
                                                                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm text-slate-900 focus:ring-2 focus:ring-purple-500 transition-all outline-none" placeholder="Descrição..." />
                                                                                <div className="grid grid-cols-2 gap-4">
                                                                                    <div>
                                                                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Quant.</label>
                                                                                        <input type="number" value={editServiceQtyStr} onChange={e => setEditServiceQtyStr(e.target.value)}
                                                                                            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-lg font-black text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Valor (R$)</label>
                                                                                        <input type="number" step="0.01" value={editServiceVal} onChange={e => setEditServiceVal(e.target.value)}
                                                                                            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-lg font-black text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none" />
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex gap-3 pt-2">
                                                                                    <button onClick={() => setEditingServiceId(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase active:bg-slate-200">Cancelar</button>
                                                                                    <button onClick={() => {
                                                                                        const newVal = parseFloat(editServiceVal) || 0;
                                                                                        const newQty = parseFloat(editServiceQtyStr) || 1;
                                                                                        setBends(prev => prev.map(b => b.id === bend.id ? { ...b, serviceDescription: editServiceDesc, serviceValue: newVal, serviceQty: newQty } : b));
                                                                                        setEditingServiceId(null);
                                                                                    }} className="flex-[2] py-4 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-purple-600/20 active:bg-purple-700">Salvar Alterações</button>
                                                                                </div>
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-5">
                                                                {/* Visualization (Clean SVG) */}
                                                                <div className="relative group active:scale-95 transition-transform" onClick={() => bend.svgDataUrl && setZoomImg(bend.svgDataUrl)}>
                                                                    <div className="w-full h-32 bg-slate-900 rounded-[2rem] overflow-hidden shadow-inner border border-white/5 relative">
                                                                        <BendCanvas
                                                                            risks={(bend.risks || []).map((r, ri) => ri === 0 ? { ...r, executionIdx: getBendExecutionLabels(bend.id, bend.lengths) } : r)}
                                                                            exportMode={true}
                                                                        />
                                                                        <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 opacity-60">
                                                                            <ZoomIn className="w-4 h-4 text-white" />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Dimensions Info */}
                                                                <div className="flex gap-3">
                                                                    <div className="flex-1 bg-slate-50 rounded-2xl p-3 flex flex-col items-center justify-center border border-slate-100">
                                                                        <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Total Linear</span>
                                                                        <span className="text-base font-black text-slate-900 leading-none">{bend.totalLengthM.toFixed(2)} <span className="text-[10px] font-bold">m</span></span>
                                                                    </div>
                                                                    <div className="flex-1 bg-brand-primary/5 rounded-2xl p-3 flex flex-col items-center justify-center border border-brand-primary/10">
                                                                        <span className="text-[9px] font-black text-brand-primary uppercase leading-none mb-1">Área M²</span>
                                                                        <span className="text-base font-black text-brand-primary leading-none">{bend.m2.toFixed(2)} <span className="text-[10px] font-bold">m²</span></span>
                                                                    </div>
                                                                    <div className="flex-1 bg-green-50 rounded-2xl p-3 flex flex-col items-center justify-center border border-green-100">
                                                                        <span className="text-[9px] font-black text-green-500 uppercase leading-none mb-1">Subtotal</span>
                                                                        <span className="text-base font-black text-green-600 leading-none">{fmt(bend.m2 * pricePerM2)}</span>
                                                                    </div>
                                                                </div>

                                                                {/* METERS INPUTS (Improved for touch) */}
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pt-1">
                                                                            <List className="w-3 h-3" /> Metros Corridos (Cortes)
                                                                        </p>
                                                                        <button onClick={() => {
                                                                            setBends(prev => prev.map(b => b.id === bend.id ? { ...b, lengths: [...b.lengths, ''] } : b));
                                                                            setTimeout(() => document.getElementById(`cut-input-${bend.id}-${bend.lengths.length}`)?.focus(), 100);
                                                                        }} className="text-[10px] font-black text-brand-primary flex items-center gap-1 active:opacity-50">
                                                                            <Plus className="w-3.5 h-3.5" /> NOVO CORTE
                                                                        </button>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
                                                                        {bend.lengths.map((l, li) => (
                                                                            <div key={li} className="relative group">
                                                                                <input
                                                                                    type="number"
                                                                                    id={`cut-input-${bend.id}-${li}`}
                                                                                    min="0.01"
                                                                                    step="0.01"
                                                                                    placeholder="0.00"
                                                                                    value={l}
                                                                                    onChange={e => updateLength(bend.id, li, e.target.value)}
                                                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-center text-lg font-black text-slate-900 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary transition-all outline-none"
                                                                                />
                                                                                {bend.lengths.length > 1 && (
                                                                                    <button
                                                                                        onClick={() => { const ls = bend.lengths.filter((_, i) => i !== li); setBends(prev => prev.map(b => b.id === bend.id ? { ...b, lengths: ls, ...calcM2(b.roundedWidthCm, ls) } : b)); }}
                                                                                        className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-sm shadow-lg active:scale-75 transition-all z-10"
                                                                                    >
                                                                                        ×
                                                                                    </button>
                                                                                )}
                                                                                {optResult.pieceToSeq && optResult.pieceToSeq[`${bend.id}-${li}`] && (
                                                                                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none opacity-40">
                                                                                        <span className="text-[7px] font-black text-slate-400 bg-white border border-slate-100 px-1 rounded uppercase tracking-tighter">
                                                                                            C{optResult.pieceToSeq[`${bend.id}-${li}`][0]}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Edit piece action */}
                                                                <button onClick={() => {
                                                                    setSelectedProductType(bend.productType || 'product');
                                                                    if (bend.product_id) {
                                                                        setSelectedProductId(bend.product_id);
                                                                        const prod = allProducts.find(p => p.id === bend.product_id);
                                                                        if (prod) setSelectedProductName(prod.name);
                                                                    }
                                                                    setEditingBendLengths([...bend.lengths]);
                                                                    setCurrentRisks(bend.risks || []);
                                                                    setBends(prev => prev.filter(b => b.id !== bend.id));
                                                                    topRef.current?.scrollIntoView({ behavior: 'smooth' });
                                                                }} className="w-full py-4 bg-slate-50 text-slate-400 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:bg-slate-100 transition-all">
                                                                    <RefreshCw className="w-4 h-4" /> Modificar Geometria / Produto
                                                                </button>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                );
                                            })}

                                            <div className="flex justify-center pt-2">
                                                <button onClick={() => {
                                                    if (selectedProductType === 'service') {
                                                        serviceDescRef.current?.scrollIntoView({ behavior: 'smooth' });
                                                        setTimeout(() => serviceDescRef.current?.focus(), 300);
                                                    } else {
                                                        topRef.current?.scrollIntoView({ behavior: 'smooth' });
                                                    }
                                                }} className="px-8 py-4 bg-brand-primary text-white font-black rounded-[1.8rem] flex items-center gap-3 cursor-pointer shadow-xl shadow-brand-primary/20 active:scale-95 transition-all uppercase text-xs tracking-widest">
                                                    <Plus className="w-5 h-5" /> Adicionar Outro Item
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Total sticky bar (Step 1) */}
                                {bends.length > 0 && (
                                    <div className="sticky bottom-6 z-30 px-4">
                                        <div className="bg-slate-900/90 backdrop-blur-3xl border border-white/20 rounded-[2.5rem] p-6 flex flex-col gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                            <div className="flex justify-between items-center w-full bg-white/5 p-4 rounded-2xl border border-white/5">
                                                <div>
                                                    <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Total m²</p>
                                                    <p className="text-white font-black text-2xl">{totalM2.toFixed(2)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Estimado</p>
                                                    <p className="text-brand-primary font-black text-3xl">{fmt(totalValue)}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 w-full">
                                                <button onClick={handleSaveDraft} disabled={savingDraft}
                                                    className="h-16 flex items-center justify-center gap-2 bg-white/10 text-white border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                                                    <Save className="w-5 h-5" /> Salvar
                                                </button>
                                                <button onClick={() => setStep('summary')} className="h-16 flex items-center justify-center gap-2 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-brand-primary/20">
                                                    Avançar <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    }

                    {/* ══ STEP 2: SUMMARY ══ */}
                    {step === 'summary' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl space-y-8" id="quote-print">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <h2 className="text-2xl font-black text-slate-900 leading-tight">Resumo Geral</h2>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-2xl">
                                        <p className="text-blue-600 font-black text-[10px] uppercase tracking-tighter">Versão Final</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                                    <p className="text-xl font-black text-slate-900">{user?.name || user?.username || clientName || 'Consumidor Final'}</p>
                                </div>

                                <div className="space-y-4">
                                    {(() => {
                                        const grouped = bends.reduce((acc, b) => {
                                            const key = b.group_name || 'Sem Grupo';
                                            if (!acc[key]) acc[key] = [];
                                            acc[key].push(b);
                                            return acc;
                                        }, {} as Record<string, Bend[]>);

                                        return Object.entries(grouped).map(([groupName, groupBends]) => (
                                            <div key={groupName} className="space-y-4">
                                                {Object.keys(grouped).length > 1 && (
                                                    <div className="flex items-center gap-3 pt-4">
                                                        <div className="w-2 h-2 bg-brand-primary rounded-full" />
                                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{groupName}</h3>
                                                    </div>
                                                )}
                                                {groupBends.map((b) => {
                                                    const globalIdx = bends.findIndex(x => x.id === b.id);
                                                    const isService = b.productType === 'service';

                                                    return (
                                                        <div key={b.id} className="bg-slate-50 border border-slate-100 rounded-3xl p-5 flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs ${isService ? 'bg-purple-500' : 'bg-slate-900'}`}>{globalIdx + 1}</div>
                                                                <div>
                                                                    <p className="text-slate-900 font-black text-sm">
                                                                        {isService ? 'Serviço' : 'Peça Industrial'} — {b.product_id ? allProducts.find(p => p.id === b.product_id)?.name : 'Geral'}
                                                                    </p>
                                                                    <p className="text-slate-500 text-[10px] font-medium leading-tight line-clamp-1">
                                                                        {isService ? b.serviceDescription : (b.risks || []).map(r => `${r.sizeCm}cm`).join(' · ')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-slate-900 font-black text-sm">{isService ? `x${b.serviceQty}` : `${b.m2.toFixed(2)}m²`}</p>
                                                                <p className={`text-[10px] font-black ${isService ? 'text-purple-600' : 'text-brand-primary'}`}>
                                                                    {fmt(isService ? (b.serviceValue || 0) * (b.serviceQty || 1) : b.m2 * pricePerM2)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ));
                                    })()}
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                            <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">Venda (m²)</label>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-300 font-black">R$</span>
                                                <input type="number" value={overridePricePerM2} onChange={e => setOverridePricePerM2(e.target.value)}
                                                    className="w-full bg-transparent text-xl font-black text-slate-900 outline-none" />
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                            <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">Custo (m²)</label>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-300 font-black">R$</span>
                                                <input type="number" value={overrideCostPerM2} onChange={e => setOverrideCostPerM2(e.target.value)}
                                                    className="w-full bg-transparent text-xl font-black text-slate-900 outline-none" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between bg-brand-primary rounded-[2.5rem] p-8 text-white shadow-xl shadow-brand-primary/20">
                                        <div>
                                            <p className="text-white/60 text-xs font-black uppercase tracking-widest mb-1">Total Geral</p>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-4xl font-black tracking-tighter">{fmt(finalWithDiscount)}</h2>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white/60 text-xs font-black uppercase tracking-widest mb-1">Lucro Est.</p>
                                            <p className="text-2xl font-black">{fmt(profit)}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Notas / Observações</label>
                                        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Endereço, cor, material..."
                                            className="w-full bg-slate-50 border border-slate-100 rounded-[1.8rem] px-6 py-4 text-slate-900 placeholder-slate-300 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all outline-none text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Summary Actions Footer */}
                            <div className="grid grid-cols-2 gap-3 pb-8">
                                <button onClick={() => setStep('bends')}
                                    className="h-16 flex items-center justify-center gap-2 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase active:bg-slate-200 transition-all">
                                    <ChevronLeft className="w-5 h-5" /> Voltar
                                </button>
                                <button onClick={handleSubmit} disabled={submitting}
                                    className="h-16 flex items-center justify-center gap-3 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-xl shadow-brand-primary/20">
                                    {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    {submitting ? 'Enviando...' : 'Finalizar e Enviar'}
                                </button>

                                <div className="col-span-2 grid grid-cols-3 gap-3">
                                    <button onClick={() => handleViewClientReport({ id: 'PREVIA', clientName }, bends)}
                                        className="flex flex-col items-center justify-center gap-2 h-20 bg-white border border-slate-100 rounded-2xl text-slate-400 active:bg-slate-50 shadow-sm transition-all">
                                        <Printer className="w-5 h-5 text-slate-400" />
                                        <span className="text-[8px] font-black uppercase">Preview</span>
                                    </button>
                                    <button onClick={() => {
                                        const w2 = window.open('', '_blank');
                                        handleDownloadQuoteCompactPDF({ id: 'PREVIA', totalM2: totalM2, totalValue: totalM2 * pricePerM2, clientName }, bends, w2);
                                    }} className="flex flex-col items-center justify-center gap-2 h-20 bg-white border border-slate-100 rounded-2xl text-slate-400 active:bg-slate-50 shadow-sm transition-all">
                                        <FileDown className="w-5 h-5 text-slate-400" />
                                        <span className="text-[8px] font-black uppercase">Obra</span>
                                    </button>
                                    <button onClick={handleDownloadPDF}
                                        className="flex flex-col items-center justify-center gap-2 h-20 bg-white border border-slate-100 rounded-2xl text-slate-400 active:bg-slate-50 shadow-sm transition-all">
                                        <FileDown className="w-5 h-5 text-slate-400" />
                                        <span className="text-[8px] font-black uppercase">Prod.</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ══ STEP 3: SUCCESS & SHARING ══ */}
                    {(step === 'success' || step === 'payment') && savedQuote && (() => {
                        const clientPhone = (() => {
                            const linked = allClients.find(c => c.id === selectedClientId || c.id === savedQuote.clientId);
                            const raw = linked?.phone || savedQuote.clientPhone || '';
                            return raw.replace(/[^+\d]/g, '');
                        })();

                        const quoteNum = String(savedQuote.id).substring(0, 8).toUpperCase();
                        const reportUrl = `${window.location.origin}/api/quotes/${savedQuote.id}/client-report`;
                        const waMsg = encodeURIComponent(
                            `Olá ${savedQuote.clientName || clientName || ''}! 😊\n\nSegue seu orçamento Nº ${quoteNum} no valor de *${fmt(finalWithDiscount)}*.\n\n📄 Visualize e imprima seu orçamento:\n${reportUrl}\n\nQualquer dúvida estou à disposição!`
                        );
                        const waLink = clientPhone ? `https://wa.me/${clientPhone}?text=${waMsg}` : null;

                        return (
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-8 pb-32">
                                <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-8 w-full max-w-sm">
                                    <div className="w-24 h-24 bg-green-500 rounded-[2rem] flex items-center justify-center shadow-xl shadow-green-500/20 rotate-3 animate-bounce">
                                        <Check className="w-12 h-12 text-white" />
                                    </div>

                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-black text-slate-900 leading-tight">Orçamento #{quoteNum}</h2>
                                        <p className="text-slate-500 font-medium px-4">Pronto para ser compartilhado com seu cliente.</p>
                                    </div>

                                    <div className="bg-slate-50 rounded-3xl p-6 w-full border border-slate-100 space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Final</p>
                                        <p className="text-3xl font-black text-brand-primary">{fmt(finalWithDiscount)}</p>
                                        <div className="pt-3 mt-3 border-t border-slate-200/50">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                                            <p className="text-lg font-black text-slate-900 truncate">{savedQuote.clientName || clientName || 'Consumidor Final'}</p>
                                            <p className="text-slate-400 text-xs font-mono">{clientPhone || 'Sem telefone'}</p>
                                        </div>
                                    </div>

                                    <div className="w-full space-y-4 pt-4">
                                        {waLink ? (
                                            <a href={waLink} target="_blank" rel="noopener noreferrer"
                                                className="h-20 w-full bg-[#25D366] text-white rounded-[1.8rem] flex items-center justify-center gap-4 font-black text-lg shadow-xl shadow-green-500/20 active:scale-95 transition-all">
                                                <Send className="w-6 h-6" /> WhatsApp
                                            </a>
                                        ) : (
                                            <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl text-xs font-bold border border-amber-100">
                                                ⚠️ Cadastre um telefone para habilitar o envio por WhatsApp
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => { handleResetQuote(); setStep('bends'); }}
                                                className="h-16 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                                                <Plus className="w-5 h-5 mx-auto mb-1" /> Novo
                                            </button>
                                            <button onClick={() => { setShowMyQuotes(true); setStep('bends'); }}
                                                className="h-16 bg-white text-slate-400 border border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest active:bg-slate-50 transition-all">
                                                <List className="w-5 h-5 mx-auto mb-1" /> Histórico
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                                            <button onClick={() => handleViewClientReport(savedQuote, bends)}
                                                className="flex flex-col items-center justify-center gap-1.5 h-20 bg-slate-50 rounded-2xl text-slate-400 active:bg-slate-100 transition-all">
                                                <Printer className="w-5 h-5" />
                                                <span className="text-[8px] font-black uppercase tracking-tighter">Preview</span>
                                            </button>
                                            <button onClick={() => {
                                                const w2 = window.open('', '_blank');
                                                handleDownloadQuoteCompactPDF(savedQuote, bends, w2);
                                            }} className="flex flex-col items-center justify-center gap-1.5 h-20 bg-slate-50 rounded-2xl text-slate-400 active:bg-slate-100 transition-all">
                                                <Printer className="w-5 h-5" />
                                                <span className="text-[8px] font-black uppercase tracking-tighter">Obra</span>
                                            </button>
                                            <button onClick={handleDownloadPDF}
                                                className="flex flex-col items-center justify-center gap-1.5 h-20 bg-slate-50 rounded-2xl text-slate-400 active:bg-slate-100 transition-all">
                                                <FileDown className="w-5 h-5" />
                                                <span className="text-[8px] font-black uppercase tracking-tighter">Produção</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })()}
                </div>
            </div>
        );
    }

    function renderDesktopUI() {
        // Calculate totals for desktop
        const totalM2 = bends.reduce((acc, b) => acc + (b.m2 || 0), 0);
        const totalPrice = totalM2 * pricePerM2;
        const totalWeight = bends.reduce((acc, b) => {
            const prod = allProducts.find(p => p.id === b.product_id);
            if (!prod || !prod.weight) return acc;
            return acc + (parseFloat(prod.weight) * b.totalLengthM);
        }, 0);

        return (
            <div className="flex min-h-screen bg-slate-50 pt-20">
                {/* Desktop Sidebar: Controls */}
                <div className="w-96 bg-slate-900 border-r border-white/10 p-6 overflow-y-auto max-h-[calc(100vh-80px)] sticky top-20 flex flex-col gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Plus className="w-5 h-5 text-blue-400" />
                            <h2 className="text-white font-black uppercase tracking-widest text-sm">Novo Item</h2>
                        </div>

                        {/* Client Search */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Cliente</label>
                            <input type="text" value={clientSearch} onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="Pesquisar cliente..." />
                        </div>

                        {/* Product Selector */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Material</label>
                            <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500/50">
                                <option value="">Selecione o Material</option>
                                {allProducts.filter(p => p.type === 'product').map(p => <option key={p.id} value={p.id} className="bg-slate-800">{p.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Bend Builder Controls */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                        <BendCanvas risks={currentRisks} svgRef={svgRef} />

                        <div className="grid grid-cols-3 gap-2">
                            {DIR_GRID.map(d => (
                                <DirBtnDesktop key={d.dir} d={d} active={pendingDir === d.dir} onClick={() => selectDirection(d.dir)} />
                            ))}
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input ref={sizeInputRef} type="number" step="0.5" placeholder="Medida (cm)" value={pendingSize}
                                    onChange={e => setPendingSize(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddRisk()}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-center outline-none focus:ring-2 focus:ring-blue-500/50" />
                                <button onClick={handleAddRisk} className="w-14 bg-blue-500 hover:bg-blue-400 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                                    <Plus className="w-6 h-6" />
                                </button>
                            </div>
                            <button onClick={handleConfirmBend} disabled={!currentRisks.length || isOver}
                                className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl shadow-lg shadow-green-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest disabled:opacity-30">
                                Adicionar Dobra
                            </button>
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/5">
                        <button onClick={handleSaveDraft} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all">
                            <Save className="w-4 h-4" /> Salvar Rascunho
                        </button>
                    </div>
                </div>

                {/* Main Content: Table and Totals */}
                <div className="flex-1 p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-80px)]">
                    <div className="flex justify-between items-center bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 leading-tight">Orçamento #{uid().toUpperCase()}</h1>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">Status: {STATUS_LABELS.draft.label}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                            <p className="text-4xl font-black text-blue-600 leading-none">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left">
                                    <th className="px-6 py-4">#</th>
                                    <th className="px-6 py-4">Representação</th>
                                    <th className="px-6 py-4">Desenvolvimento</th>
                                    <th className="px-6 py-4">Metros</th>
                                    <th className="px-6 py-4">Área (m²)</th>
                                    <th className="px-6 py-4 text-right">Subtotal</th>
                                    <th className="px-6 py-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {bends.map((b, i) => (
                                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-6 font-bold text-slate-400">{i + 1}</td>
                                        <td className="px-6 py-6">
                                            <div className="w-24 h-12 bg-slate-900 rounded-lg overflow-hidden border border-slate-200">
                                                <BendCanvas risks={b.risks} exportMode={true} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex flex-wrap gap-1">
                                                {b.risks.map((r, ri) => (
                                                    <span key={ri} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                                                        {DIRECTION_ICONS[r.direction]}{r.sizeCm}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-[10px] font-black text-blue-500 mt-1 uppercase tracking-tighter">Total: {b.roundedWidthCm}cm</p>
                                        </td>
                                        <td className="px-6 py-6 font-bold text-slate-700">{b.totalLengthM.toFixed(2)}m</td>
                                        <td className="px-6 py-6 font-bold text-slate-700">{b.m2.toFixed(2)}m²</td>
                                        <td className="px-6 py-6 text-right font-black text-slate-900">R$ {(b.m2 * pricePerM2).toFixed(2)}</td>
                                        <td className="px-6 py-6 text-center">
                                            <button onClick={() => setBends(prev => prev.filter(item => item.id !== b.id))}
                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {bends.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center">
                                            <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                            <p className="text-slate-400 font-medium">Nenhuma dobra adicionada ao orçamento.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 pb-20">
                        <button onClick={handleResetQuote} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all cursor-pointer">
                            Reiniciar Orçamento
                        </button>
                        <button onClick={handleSubmit} className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-2">
                            <Send className="w-5 h-5" /> Finalizar e Gerar PDF
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
