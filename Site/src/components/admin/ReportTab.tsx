import React, { useState, useEffect } from 'react';
import { Save, Upload, Image as ImageIcon, FileText, DollarSign, MessageSquare, Plus, Trash2, Clock, CheckCircle2 } from 'lucide-react';

interface Props {
    showToast: (msg: string, type: 'success' | 'error') => void;
    isAdmin: boolean;
    isMaster: boolean;
}

export default function ReportTab({ showToast, isAdmin, isMaster }: Props) {
    const [config, setConfig] = useState({
        reportLogo: '',
        reportCompanyName: '',
        reportHeaderText: '',
        reportFooterText: '',
        reportPhone: '',
        reportEmail: '',
        reportAddress: '',
        reportPaymentTerms: '',
        reportExecDays: '',
        reportValidityDays: '7',
        // Financials (moved from General)
        pricePerM2: '',
        costPerM2: '',
        lowStockAlertM2: '',
        pixKey: '',
        // WhatsApp (moved from General)
        whatsappAutomationEnabled: 'false',
        whatsappApiUrl: '',
        whatsappApiKey: '',
        whatsappMsgLembrete: '',
        whatsappMsgAnteExpiracao: '',
        whatsappMsgEnvio: 'Olá {cliente}, segue seu orçamento da Ferreira Calhas. Qualquer dúvida estou à disposição.',
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // PIX Management
    const [pixKeys, setPixKeys] = useState<any[]>([]);
    const [newPix, setNewPix] = useState({ label: '', pixKey: '', keyType: 'cpf', bank: '', beneficiary: '', pixCode: '', qrCodeUrl: '' });

    useEffect(() => {
        fetchConfig();
        if (isMaster) fetchPixKeys();
    }, [isMaster]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/data', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                const s = data.settings || {};
                setConfig({
                    reportLogo: s.reportLogo || '',
                    reportCompanyName: s.reportCompanyName || '',
                    reportHeaderText: s.reportHeaderText || '',
                    reportFooterText: s.reportFooterText || '',
                    reportPhone: s.reportPhone || '',
                    reportEmail: s.reportEmail || '',
                    reportAddress: s.reportAddress || '',
                    reportPaymentTerms: s.reportPaymentTerms || '',
                    reportExecDays: s.reportExecDays || '',
                    reportValidityDays: s.reportValidityDays || '7',
                    pricePerM2: s.pricePerM2 || '',
                    costPerM2: s.costPerM2 || '',
                    lowStockAlertM2: s.lowStockAlertM2 || '',
                    pixKey: s.pixKey || '',
                    whatsappAutomationEnabled: s.whatsappAutomationEnabled || 'false',
                    whatsappApiUrl: s.whatsappApiUrl || '',
                    whatsappApiKey: s.whatsappApiKey || '',
                    whatsappMsgLembrete: s.whatsappMsgLembrete || '',
                    whatsappMsgAnteExpiracao: s.whatsappMsgAnteExpiracao || '',
                    whatsappMsgEnvio: s.whatsappMsgEnvio || 'Olá {cliente}, segue seu orçamento da Ferreira Calhas. Qualquer dúvida estou à disposição.',
                });
                if (s.reportLogo) setLogoPreview(s.reportLogo);
            }
        } catch { showToast('Erro ao carregar configurações', 'error'); }
        finally { setLoading(false); }
    };

    const fetchPixKeys = async () => {
        try {
            const res = await fetch('/api/pix-keys', { credentials: 'include' });
            if (res.ok) setPixKeys(await res.json());
        } catch { }
    };

    const handleAddPix = async () => {
        if (!newPix.pixKey) return showToast('Chave PIX obrigatória', 'error');
        try {
            const res = await fetch('/api/pix-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPix),
                credentials: 'include'
            });
            if (res.ok) {
                showToast('Chave PIX adicionada!', 'success');
                setNewPix({ label: '', pixKey: '', keyType: 'cpf', bank: '', beneficiary: '', pixCode: '', qrCodeUrl: '' });
                fetchPixKeys();
            }
        } catch { showToast('Erro ao adicionar PIX', 'error'); }
    };

    const handleDeletePix = async (id: number) => {
        if (!confirm('Excluir esta chave PIX?')) return;
        try {
            const res = await fetch(`/api/pix-keys/${id}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) { showToast('PIX excluído', 'success'); fetchPixKeys(); }
        } catch { showToast('Erro ao excluir', 'error'); }
    };

    const handleTogglePix = async (pk: any) => {
        try {
            const res = await fetch(`/api/pix-keys/${pk.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !pk.active }),
                credentials: 'include'
            });
            if (res.ok) fetchPixKeys();
        } catch { }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const fd = new FormData();
            Object.entries(config).forEach(([k, v]) => {
                fd.append(k, String(v));
            });
            if (logoFile) fd.append('reportLogoFile', logoFile);

            const res = await fetch('/api/report-settings', {
                method: 'POST', body: fd, credentials: 'include',
            });
            if (res.ok) {
                showToast('Configurações salvas!', 'success');
                setLogoFile(null);
                fetchConfig();
            } else {
                showToast('Erro ao salvar', 'error');
            }
        } catch { showToast('Erro de conexão', 'error'); }
        finally { setSaving(false); }
    };

    const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all";

    if (loading) return (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>
    );

    return (
        <div className="space-y-12 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-20 py-4 border-b border-slate-100">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Painel de Configuração</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Relatórios, Financeiro e Automação</p>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all cursor-pointer disabled:opacity-50">
                    {saving ? <Save className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} SALVAR TUDO
                </button>
            </div>

            {/* 1️⃣ CONFIGURAÇÕES DO RELATÓRIO */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black">1</div>
                    <h3 className="text-xl font-bold text-slate-900">Configurações do Relatório</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Logo Section */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 lg:col-span-1">
                        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-blue-500" /> Logotipo</h4>
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-full aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center overflow-hidden">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-4" />
                                ) : (
                                    <ImageIcon className="w-12 h-12 text-slate-300" />
                                )}
                            </div>
                            <label className="w-full bg-blue-50 text-blue-600 py-3 rounded-2xl text-center text-sm font-bold cursor-pointer hover:bg-blue-100 transition-all">
                                <Upload className="w-4 h-4 inline mr-2" /> Alterar Logotipo
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
                                }} />
                            </label>
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 lg:col-span-2 space-y-4">
                        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /> Dados da Empresa</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Nome da Empresa</label>
                                <input value={config.reportCompanyName} onChange={e => setConfig({ ...config, reportCompanyName: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Telefone Comercial</label>
                                <input value={config.reportPhone} onChange={e => setConfig({ ...config, reportPhone: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">E-mail para Orçamentos</label>
                                <input value={config.reportEmail} onChange={e => setConfig({ ...config, reportEmail: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Endereço Completo</label>
                                <input value={config.reportAddress} onChange={e => setConfig({ ...config, reportAddress: e.target.value })} className={inputCls} />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Cabeçalho Personalizado (CNPJ, etc)</label>
                            <textarea value={config.reportHeaderText} onChange={e => setConfig({ ...config, reportHeaderText: e.target.value })} rows={2} className={inputCls + " resize-none"} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Condições de Pagamento</label>
                        <input value={config.reportPaymentTerms} onChange={e => setConfig({ ...config, reportPaymentTerms: e.target.value })} className={inputCls} placeholder="Ex: 50% entrada e 50% entrega" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Prazo de Execução (Dias)</label>
                        <input type="number" value={config.reportExecDays} onChange={e => setConfig({ ...config, reportExecDays: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Rodapé do Relatório</label>
                        <input value={config.reportFooterText} onChange={e => setConfig({ ...config, reportFooterText: e.target.value })} className={inputCls} />
                    </div>
                </div>
            </section>

            {/* 2️⃣ CONFIGURAÇÕES FINANCEIRAS */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center font-black">2</div>
                    <h3 className="text-xl font-bold text-slate-900">Configurações Financeiras</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Prices */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 lg:col-span-1 space-y-4">
                        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-500" /> Valores Padrão</h4>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Valor Venda Metro Quadrado (R$)</label>
                            <input type="number" step="0.01" value={config.pricePerM2} onChange={e => setConfig({ ...config, pricePerM2: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Custo Metro Quadrado Calha (R$)</label>
                            <input type="number" step="0.01" value={config.costPerM2} onChange={e => setConfig({ ...config, costPerM2: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Validade Orçamento (Dias)</label>
                            <input type="number" value={config.reportValidityDays} onChange={e => setConfig({ ...config, reportValidityDays: e.target.value })} className={inputCls} />
                        </div>
                    </div>

                    {/* PIX Management */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 lg:col-span-2 space-y-4">
                        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">💳 Gestão de Chaves PIX</h4>

                        {/* New PIX Key Field (Direct text for simple use) */}
                        <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <label className="text-[10px] font-black text-slate-500 uppercase ml-1 mb-1 block">Chave PIX Principal (Texto p/ Relatório)</label>
                            <input value={config.pixKey} onChange={e => setConfig({ ...config, pixKey: e.target.value })} placeholder="Ex: CNPJ 00.000.000/0001-00" className={inputCls} />
                        </div>

                        {/* Multi PIX Management */}
                        {isMaster && (
                            <div className="space-y-4">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Chaves Cadastradas (QR Code e Recebimento)</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {pixKeys.map(pk => (
                                        <div key={pk.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${pk.active ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-900 text-xs truncate">{pk.label}</p>
                                                <p className="text-[10px] text-slate-500 font-mono truncate">{pk.pixKey}</p>
                                            </div>
                                            <button onClick={() => handleTogglePix(pk)} className={`text-[10px] font-black px-2 py-1 rounded-lg ${pk.active ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                                                {pk.active ? 'ATIVO' : 'OFF'}
                                            </button>
                                            <button onClick={() => handleDeletePix(pk.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <input placeholder="Apelido" value={newPix.label} onChange={e => setNewPix({ ...newPix, label: e.target.value })} className="text-xs px-3 py-2 rounded-lg border border-slate-200" />
                                        <input placeholder="Chave *" value={newPix.pixKey} onChange={e => setNewPix({ ...newPix, pixKey: e.target.value })} className="text-xs px-3 py-2 rounded-lg border border-slate-200" />
                                        <select value={newPix.keyType} onChange={e => setNewPix({ ...newPix, keyType: e.target.value })} className="text-xs px-3 py-2 rounded-lg border border-slate-200">
                                            <option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option>
                                        </select>
                                    </div>
                                    <button onClick={handleAddPix} className="w-full bg-slate-800 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                                        <Plus className="w-4 h-4" /> Cadastrar Nova Chave
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* 3️⃣ AUTOMAÇÃO WHATSAPP */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center font-black">3</div>
                    <h3 className="text-xl font-bold text-slate-900">Automação WhatsApp</h3>
                </div>

                <div className="bg-white rounded-3xl p-8 border border-slate-200 space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <MessageSquare className="w-6 h-6 text-green-500" />
                            <div>
                                <h4 className="font-bold text-slate-900">Follow-up Automático</h4>
                                <p className="text-xs text-slate-400">Envio de mensagens automáticas pela API</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 mr-2">Status do Robô:</span>
                            <select value={config.whatsappAutomationEnabled} onChange={e => setConfig({ ...config, whatsappAutomationEnabled: e.target.value })}
                                className={`text-xs font-black px-4 py-2 rounded-xl border ${config.whatsappAutomationEnabled === 'true' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                <option value="false">🔴 DESATIVADO</option>
                                <option value="true">🟢 ATIVADO</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Templates */}
                        <div className="space-y-4">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock className="w-3 h-3" /> Mensagens Programadas</h5>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-2 block">1️⃣ Envio Inicial (Imediato no Clique)</label>
                                    <textarea value={config.whatsappMsgEnvio} onChange={e => setConfig({ ...config, whatsappMsgEnvio: e.target.value })} rows={3} className={inputCls + " bg-slate-50/50"} />
                                    <p className="text-[10px] text-slate-400 mt-1 italic">Dica: Use {'{cliente}'} para o nome e {'{id}'} para o orçamento.</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-2 block">2️⃣ Lembrete pós 24h</label>
                                    <textarea value={config.whatsappMsgLembrete} onChange={e => setConfig({ ...config, whatsappMsgLembrete: e.target.value })} rows={2} className={inputCls + " bg-slate-50/50"} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-2 block">3️⃣ Aviso de Expiração (Faltando 1 dia)</label>
                                    <textarea value={config.whatsappMsgAnteExpiracao} onChange={e => setConfig({ ...config, whatsappMsgAnteExpiracao: e.target.value })} rows={2} className={inputCls + " bg-slate-50/50"} />
                                </div>
                            </div>
                        </div>

                        {/* Connection config */}
                        <div className="space-y-4">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Settings className="w-3 h-3" /> Configuração Técnica (Evolution API)</h5>
                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Endpoint de Envio</label>
                                    <input value={config.whatsappApiUrl} onChange={e => setConfig({ ...config, whatsappApiUrl: e.target.value })} placeholder="https://api.seuserver.com/message/sendText/..." className={inputCls + " bg-white border-transparent text-xs"} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Chave de API (apikey)</label>
                                    <input type="password" value={config.whatsappApiKey} onChange={e => setConfig({ ...config, whatsappApiKey: e.target.value })} className={inputCls + " bg-white border-transparent text-xs"} />
                                </div>
                                <div className="pt-2">
                                    <p className="text-[11px] text-slate-500 leading-relaxed mb-4">Essas configurações permitem que o sistema envie notificações automáticas de followup para seus clientes.</p>
                                    <button type="button" onClick={() => alert('Função de teste de conexão disponível no backend.')}
                                        className="w-full border-2 border-slate-200 text-slate-600 py-3 rounded-2xl text-xs font-black hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                                        ⚡ TESTAR CONEXÃO
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

// Reuse some icons if not imported
const Settings = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
