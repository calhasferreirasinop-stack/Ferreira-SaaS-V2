import React, { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
    showToast: (msg: string, type: 'success' | 'error') => void;
}

// ── Países disponíveis ────────────────────────────────────────────────────────
const COUNTRY_CODES = [
    { code: '+55', flag: '🇧🇷', name: 'Brasil', mask: '(##) #####-####', digits: 11 },
    { code: '+1', flag: '🇺🇸', name: 'EUA/CA', mask: '(###) ###-####', digits: 10 },
    { code: '+44', flag: '🇬🇧', name: 'Reino Unido', mask: '####-######', digits: 10 },
    { code: '+351', flag: '🇵🇹', name: 'Portugal', mask: '### ### ###', digits: 9 },
    { code: '+54', flag: '🇦🇷', name: 'Argentina', mask: '(###) ###-####', digits: 10 },
    { code: '+595', flag: '🇵🇾', name: 'Paraguai', mask: '(###) ###-###', digits: 9 },
    { code: '+598', flag: '🇺🇾', name: 'Uruguai', mask: '#### ####', digits: 8 },
    { code: '+56', flag: '🇨🇱', name: 'Chile', mask: '# ####-####', digits: 9 },
    { code: '+57', flag: '🇨🇴', name: 'Colômbia', mask: '(###) ###-####', digits: 10 },
];

// Extrai código do país do número completo (ex: "+55 (66) 99000-0000" → "+55")
const extractCountryCode = (phone: string): string => {
    if (!phone) return '+55';
    const match = phone.match(/^(\+\d+)/);
    if (match) {
        const found = COUNTRY_CODES.find(c => c.code === match[1]);
        return found ? found.code : '+55';
    }
    return '+55';
};

// Extrai número local sem o código do país
const extractLocalNumber = (phone: string): string => {
    if (!phone) return '';
    return phone.replace(/^\+\d+\s?/, '');
};

// Aplica máscara brasileira (padrão) ou genérica
const applyBRMask = (digits: string): string => {
    const d = digits.replace(/\D/g, '').slice(0, 11);
    if (d.length === 0) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export default function ClientsTab({ showToast }: Props) {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<any>(null);

    const [formData, setFormData] = useState({
        name: '',
        countryCode: '+55',
        localPhone: '',
        email: '',
        document: '',
        address: '',
        notes: ''
    });

    // Número completo para envio à API
    const fullPhone = `${formData.countryCode} ${formData.localPhone}`.trim();

    const handleLocalPhoneChange = (val: string) => {
        const masked = formData.countryCode === '+55'
            ? applyBRMask(val)
            : val; // outros países: formato livre
        setFormData(prev => ({ ...prev, localPhone: masked }));
    };

    const fetchClients = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/clients', { credentials: 'include' });
            if (res.ok) setClients(await res.json());
        } catch {
            showToast('Erro ao carregar clientes', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClients(); }, []);

    const handleOpenModal = (client?: any) => {
        if (client) {
            setEditingClient(client);
            const cc = extractCountryCode(client.phone);
            const local = extractLocalNumber(client.phone);
            setFormData({
                name: client.name || '',
                countryCode: cc,
                localPhone: local,
                email: client.email || '',
                document: client.document || '',
                address: client.address || '',
                notes: client.notes || ''
            });
        } else {
            setEditingClient(null);
            setFormData({ name: '', countryCode: '+55', localPhone: '', email: '', document: '', address: '', notes: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return showToast('Nome é obrigatório', 'error');
        if (!formData.localPhone.trim()) return showToast('Telefone é obrigatório', 'error');

        const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients';
        const method = editingClient ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, phone: fullPhone }),
                credentials: 'include'
            });
            if (!res.ok) throw new Error(await res.text());
            showToast(`Cliente ${editingClient ? 'atualizado' : 'cadastrado'} com sucesso!`, 'success');
            setIsModalOpen(false);
            fetchClients();
        } catch (err: any) {
            showToast(err.message || 'Erro ao salvar cliente', 'error');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
        try {
            const res = await fetch(`/api/clients/${id}`, { method: 'DELETE', credentials: 'include' });
            if (!res.ok) throw new Error();
            showToast('Cliente excluído', 'success');
            fetchClients();
        } catch {
            showToast('Erro ao excluir cliente', 'error');
        }
    };

    const inputCls = "w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-primary transition-all outline-none text-sm";

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Users className="w-8 h-8 text-brand-primary" />
                    Clientes
                </h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Novo Cliente
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : clients.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Nenhum cliente cadastrado ainda.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map(client => (
                        <motion.div
                            key={client.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group relative"
                        >
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleOpenModal(client)}
                                    className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-brand-primary hover:text-white transition-colors"
                                    title="Editar"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(client.id)}
                                    className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-red-500 hover:text-white transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center mb-4">
                                <Users className="w-6 h-6" />
                            </div>

                            <h3 className="font-bold text-lg text-slate-800 mb-1 pr-16">{client.name}</h3>

                            <div className="space-y-2 mt-4 text-sm text-slate-500">
                                {client.phone && (
                                    <p className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 shrink-0 text-slate-400" />
                                        <span className="font-mono text-xs">{client.phone}</span>
                                    </p>
                                )}
                                {client.email && (
                                    <p className="flex items-center gap-2 truncate">
                                        <Mail className="w-4 h-4 shrink-0 text-slate-400" />
                                        {client.email}
                                    </p>
                                )}
                                {client.document && (
                                    <p className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 shrink-0 text-slate-400" />
                                        {client.document}
                                    </p>
                                )}
                                {client.address && (
                                    <p className="flex items-center gap-2 truncate">
                                        <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                                        {client.address}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* ── Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold">
                                    {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Nome */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-2">Nome Completo *</label>
                                        <input
                                            required type="text" className={inputCls}
                                            placeholder="Ex: João da Silva"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>

                                    {/* Telefone com código do país */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-2">WhatsApp / Telefone *</label>
                                        <div className="flex gap-2">
                                            {/* Seletor de País */}
                                            <select
                                                value={formData.countryCode}
                                                onChange={e => setFormData(prev => ({ ...prev, countryCode: e.target.value, localPhone: '' }))}
                                                className="bg-slate-50 border-none rounded-2xl px-3 py-4 focus:ring-2 focus:ring-brand-primary outline-none text-sm font-bold w-[110px] flex-shrink-0 cursor-pointer"
                                            >
                                                {COUNTRY_CODES.map(c => (
                                                    <option key={c.code} value={c.code}>
                                                        {c.flag} {c.code}
                                                    </option>
                                                ))}
                                            </select>
                                            {/* Número local */}
                                            <input
                                                required type="text"
                                                className={`${inputCls} flex-1`}
                                                placeholder={formData.countryCode === '+55' ? '(66) 99000-0000' : 'Número local'}
                                                value={formData.localPhone}
                                                onChange={e => handleLocalPhoneChange(e.target.value)}
                                                maxLength={formData.countryCode === '+55' ? 16 : 20}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 ml-2">
                                            Número completo: <span className="font-mono font-bold text-slate-600">{fullPhone || '—'}</span>
                                        </p>
                                    </div>

                                    {/* E-mail */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-2">E-mail (Opcional)</label>
                                        <input
                                            type="email" className={inputCls}
                                            placeholder="joao@email.com"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>

                                    {/* CPF / CNPJ */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-2">CPF / CNPJ (Opcional)</label>
                                        <input
                                            type="text" className={inputCls}
                                            placeholder="000.000.000-00"
                                            value={formData.document}
                                            onChange={e => setFormData({ ...formData, document: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Endereço */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-2">Endereço Completo (Opcional)</label>
                                    <input
                                        type="text" className={inputCls}
                                        placeholder="Rua, Número, Bairro, Cidade - UF"
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>

                                {/* Observações */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-2">Observações (Opcional)</label>
                                    <textarea
                                        className={`${inputCls} min-h-[100px] resize-none`}
                                        placeholder="Anotações sobre este cliente..."
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                </div>

                                <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-4 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors w-full md:w-auto">
                                        Cancelar
                                    </button>
                                    <button type="submit"
                                        className="px-8 py-4 rounded-2xl font-bold bg-brand-primary text-white hover:opacity-90 transition-opacity shadow-lg shadow-brand-primary/20 w-full md:flex-1">
                                        {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
