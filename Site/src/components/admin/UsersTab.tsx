import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Shield, Crown, User } from 'lucide-react';

const ROLE_CONFIG = {
    user: { label: 'Usuário', icon: User, color: 'text-slate-400 bg-slate-100' },
    admin: { label: 'Admin', icon: Shield, color: 'text-blue-600 bg-blue-100' },
    master: { label: 'Master', icon: Crown, color: 'text-amber-600 bg-amber-100' },
};

interface Props {
    users: any[];
    currentUser: any;
    onSave: () => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
}

const emptyForm = { username: '', password: '', name: '', phone: '', role: 'user', active: true };

export default function UsersTab({ users, currentUser, onSave, showToast }: Props) {
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(false);

    const startNew = () => { setEditing('new'); setForm(emptyForm); };
    const startEdit = (u: any) => {
        setEditing(u.id);
        setForm({ username: u.username || '', password: '', name: u.name || '', phone: u.phone || '', role: u.role, active: u.active });
    };
    const cancel = () => { setEditing(null); setForm(emptyForm); };

    const handleSave = async () => {
        if (!form.username) return showToast('Usuário (Login) é obrigatório', 'error');
        if (editing === 'new' && !form.password) return showToast('Senha é obrigatória', 'error');
        setLoading(true);
        try {
            const url = editing === 'new' ? '/api/users' : `/api/users/${editing}`;
            const body = editing === 'new' ? form : { ...form, password: form.password || undefined };
            const payload = {
                ...form,
                password: form.password || undefined
            };
            const res = await fetch(url, {
                method: editing === 'new' ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include',
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            showToast(editing === 'new' ? 'Usuário criado!' : 'Usuário atualizado!', 'success');
            cancel();
            onSave();
        } catch (e: any) {
            showToast(e.message || 'Erro ao salvar', 'error');
        } finally { setLoading(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir usuário?')) return;
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) { showToast('Usuário excluído!', 'success'); onSave(); }
        else showToast('Erro ao excluir', 'error');
    };

    const toggleActive = async (u: any) => {
        await fetch(`/api/users/${u.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !u.active, name: u.name, phone: u.phone, username: u.username }),
            credentials: 'include',
        });
        onSave();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Gerenciar Usuários</h2>
                <button onClick={startNew}
                    className="bg-brand-primary text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all text-sm cursor-pointer">
                    <Plus className="w-4 h-4" /> Novo Usuário
                </button>
            </div>

            {/* Form */}
            {editing && (
                <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-200">
                    <h3 className="font-bold text-slate-900">{editing === 'new' ? 'Novo Usuário' : 'Editar Usuário'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Usuário / Login *</label>
                            <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                                disabled={editing !== 'new'}
                                type="text"
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none disabled:opacity-50" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">{editing === 'new' ? 'Senha *' : 'Nova Senha (opcional)'}</label>
                            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Nome Completo *</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="Nome Completo *"
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Telefone</label>
                            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-2">Papel / Permissão *</label>
                            <div className="flex gap-2">
                                {(['user', 'admin', ...(currentUser?.role === 'master' ? ['master'] : [])] as string[]).map(r => {
                                    const cfg = ROLE_CONFIG[r as keyof typeof ROLE_CONFIG];
                                    return (
                                        <button key={r} onClick={() => setForm({ ...form, role: r })}
                                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer
                                                ${form.role === r ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={cancel}
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                            <X className="w-4 h-4" /> Cancelar
                        </button>
                        <button onClick={handleSave} disabled={loading}
                            className="px-6 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-2">
                            <Check className="w-4 h-4" /> {loading ? 'Salvando…' : 'Salvar'}
                        </button>
                    </div>
                </div>
            )}

            {/* Users list */}
            <div className="space-y-3">
                {users.map(u => {
                    const cfg = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.user;
                    const Icon = cfg.icon;
                    return (
                        <div key={u.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${u.active ? 'bg-white border-slate-100 hover:shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-900">{u.name || (u.username || u.name)}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                                    {!u.active && <span className="text-xs text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full">Inativo</span>}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">{u.phone || ''}</p>
                            </div>
                            {u.id !== currentUser?.id && (
                                <div className="flex gap-2">
                                    <button onClick={() => toggleActive(u)} title={u.active ? 'Desativar' : 'Ativar'}
                                        className={`p-2 rounded-xl transition-all cursor-pointer ${u.active ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => startEdit(u)}
                                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all cursor-pointer">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(u.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            {u.id === currentUser?.id && <span className="text-xs text-slate-400 italic">Você</span>}
                        </div>
                    );
                })}
                {users.length === 0 && <p className="text-slate-400 text-center py-8">Nenhum usuário encontrado.</p>}
            </div>
        </div>
    );
}
