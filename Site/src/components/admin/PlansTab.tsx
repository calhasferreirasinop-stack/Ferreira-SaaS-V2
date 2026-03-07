import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, CreditCard, Calendar, Activity, Building2 } from 'lucide-react';

interface Subscription {
    id: string;
    company_id: string;
    plan_id: string;
    status: 'trial' | 'active' | 'past_due' | 'canceled';
    current_period_end: string;
    created_at: string;
    company_name?: string;
}

interface Company {
    id: string;
    name: string;
}

interface Props {
    showToast: (msg: string, type: 'success' | 'error') => void;
}

const PLAN_OPTIONS = [
    { id: 'plan_basic', label: 'Básico' },
    { id: 'plan_pro', label: 'Profissional' },
    { id: 'plan_master', label: 'Master' },
];

const STATUS_CONFIG = {
    trial: { label: 'Teste', color: 'text-blue-600 bg-blue-50' },
    active: { label: 'Ativo', color: 'text-green-600 bg-green-50' },
    past_due: { label: 'Atrasado', color: 'text-orange-600 bg-orange-50' },
    canceled: { label: 'Cancelado', color: 'text-red-600 bg-red-50' },
};

export default function PlansTab({ showToast }: Props) {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | 'new' | null>(null);
    const [form, setForm] = useState<Partial<Subscription>>({ company_id: '', plan_id: 'plan_basic', status: 'trial', current_period_end: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [splitSubs, splitComp] = await Promise.all([
                fetch('/api/subscriptions', { credentials: 'include' }).then(r => r.json()),
                fetch('/api/companies', { credentials: 'include' }).then(r => r.json())
            ]);

            setCompanies(splitComp);

            // Map company names to subscriptions
            const mappedSubs = splitSubs.map((s: Subscription) => ({
                ...s,
                company_name: splitComp.find((c: Company) => c.id === s.company_id)?.name || 'Empresa desconhecida'
            }));

            setSubscriptions(mappedSubs);
        } catch (e) {
            showToast('Erro ao carregar planos', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const startNew = () => {
        setEditing('new');
        setForm({ company_id: '', plan_id: 'plan_basic', status: 'trial', current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] });
    };

    const startEdit = (s: Subscription) => {
        setEditing(s.id);
        setForm({ ...s, current_period_end: s.current_period_end ? new Date(s.current_period_end).toISOString().split('T')[0] : '' });
    };

    const cancel = () => {
        setEditing(null);
        setForm({});
    };

    const handleSave = async () => {
        if (!form.company_id || !form.plan_id) return showToast('Empresa e Plano são obrigatórios', 'error');

        try {
            const method = editing === 'new' ? 'POST' : 'PUT';
            const url = editing === 'new' ? '/api/subscriptions' : `/api/subscriptions/${editing}`;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
                credentials: 'include'
            });

            if (res.ok) {
                showToast(editing === 'new' ? 'Plano vinculado!' : 'Plano atualizado!', 'success');
                cancel();
                fetchData();
            } else {
                const d = await res.json();
                throw new Error(d.error || 'Erro ao salvar');
            }
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Remover este plano/assinatura?')) return;
        try {
            const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                showToast('Assinatura removida!', 'success');
                fetchData();
            }
        } catch (e) {
            showToast('Erro ao excluir', 'error');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Gestão de Planos</h2>
                <button onClick={startNew}
                    className="bg-brand-primary text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all text-sm cursor-pointer">
                    <Plus className="w-4 h-4" /> Vincular Plano
                </button>
            </div>

            {editing && (
                <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-200">
                    <h3 className="font-bold text-slate-900">{editing === 'new' ? 'Novo Vínculo de Plano' : 'Editar Plano'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Empresa *</label>
                            <select value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}
                                disabled={editing !== 'new'}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none disabled:opacity-50">
                                <option value="">Selecione uma empresa...</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Cota de Plano *</label>
                            <select value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none">
                                {PLAN_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Status</label>
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none">
                                {Object.entries(STATUS_CONFIG).map(([id, cfg]) => <option key={id} value={id}>{cfg.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Expira em</label>
                            <input type="date" value={form.current_period_end} onChange={e => setForm({ ...form, current_period_end: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={cancel}
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                            <X className="w-4 h-4" /> Cancelar
                        </button>
                        <button onClick={handleSave}
                            className="px-6 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm hover:opacity-90 cursor-pointer flex items-center gap-2">
                            <Check className="w-4 h-4" /> Salvar
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-100 font-bold text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="px-6 py-4">Empresa / Plano</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Vencimento</th>
                            <th className="px-6 py-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {subscriptions.map(s => {
                            const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.trial;
                            const planName = PLAN_OPTIONS.find(p => p.id === s.plan_id)?.label || s.plan_id;
                            return (
                                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                                                <CreditCard className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">{planName}</div>
                                                <div className="text-xs text-slate-400 flex items-center gap-1">
                                                    <Building2 className="w-3 h-3" /> {s.company_name}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${statusCfg.color}`}>
                                            {statusCfg.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Calendar className="w-4 h-4 text-slate-300" />
                                            {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : 'Sem data'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => startEdit(s)}
                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all cursor-pointer">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(s.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && subscriptions.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold">Nenhum plano vinculado.</td>
                            </tr>
                        )}
                        {loading && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 animate-pulse">Carregando planos...</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
