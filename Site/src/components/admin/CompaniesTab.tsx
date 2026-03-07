import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, Building2, Mail, Phone, Globe } from 'lucide-react';
import clsx from 'clsx';

interface Company {
    id: string;
    name: string;
    business_type?: string;
    cnpj?: string;
    email?: string;
    phone?: string;
    created_at: string;
    settings?: any;
}

interface Props {
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function CompaniesTab({ showToast }: Props) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | 'new' | null>(null);
    const [form, setForm] = useState<Partial<Company>>({ name: '', business_type: '', cnpj: '', email: '', phone: '' });

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/companies', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setCompanies(data);
            }
        } catch (e) {
            showToast('Erro ao carregar empresas', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    const startNew = () => {
        setEditing('new');
        setForm({ name: '', business_type: '', cnpj: '', email: '', phone: '' });
    };

    const startEdit = (c: Company) => {
        setEditing(c.id);
        setForm({ ...c });
    };

    const cancel = () => {
        setEditing(null);
        setForm({});
    };

    const handleSave = async () => {
        if (!form.name) return showToast('Nome da empresa é obrigatório', 'error');

        try {
            const method = editing === 'new' ? 'POST' : 'PUT';
            const url = editing === 'new' ? '/api/companies' : `/api/companies/${editing}`;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
                credentials: 'include'
            });

            if (res.ok) {
                showToast(editing === 'new' ? 'Empresa criada!' : 'Empresa atualizada!', 'success');
                cancel();
                fetchCompanies();
            } else {
                const d = await res.json();
                throw new Error(d.error || 'Erro ao salvar');
            }
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir empresa permanentemente? Isso pode afetar usuários vinculados.')) return;
        try {
            const res = await fetch(`/api/companies/${id}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                showToast('Empresa excluída!', 'success');
                fetchCompanies();
            }
        } catch (e) {
            showToast('Erro ao excluir', 'error');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Gestão de Empresas</h2>
                <button onClick={startNew}
                    className="bg-brand-primary text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all text-sm cursor-pointer">
                    <Plus className="w-4 h-4" /> Nova Empresa
                </button>
            </div>

            {editing && (
                <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-200">
                    <h3 className="font-bold text-slate-900">{editing === 'new' ? 'Cadastrar Empresa' : 'Editar Empresa'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Nome da Empresa *</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Tipo de Negócio</label>
                            <input value={form.business_type} onChange={e => setForm({ ...form, business_type: e.target.value })}
                                placeholder="Ex: Calhas, Esquadrias..."
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">CNPJ</label>
                            <input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">E-mail</label>
                            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Telefone</label>
                            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
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
                            <th className="px-6 py-4">Empresa</th>
                            <th className="px-6 py-4">Contato</th>
                            <th className="px-6 py-4">CNPJ</th>
                            <th className="px-6 py-4">Criação</th>
                            <th className="px-6 py-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {companies.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{c.name}</div>
                                            <div className="text-xs text-slate-400">{c.business_type || 'Geral'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="space-y-1">
                                        {c.email && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Mail className="w-3 h-3" /> {c.email}
                                            </div>
                                        )}
                                        {c.phone && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Phone className="w-3 h-3" /> {c.phone}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                                    {c.cnpj || '—'}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-400">
                                    {new Date(c.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => startEdit(c)}
                                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all cursor-pointer">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(c.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && companies.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">Nenhuma empresa encontrada.</td>
                            </tr>
                        )}
                        {loading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 animate-pulse">Carregando empresas...</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
