import React, { useState, useEffect } from 'react';
import { Save, Upload, Image as ImageIcon, FileText } from 'lucide-react';

interface Props {
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function ReportTab({ showToast }: Props) {
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
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConfig();
    }, []);

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
                });
                if (s.reportLogo) setLogoPreview(s.reportLogo);
            }
        } catch { showToast('Erro ao carregar configurações', 'error'); }
        finally { setLoading(false); }
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('reportCompanyName', config.reportCompanyName);
            fd.append('reportHeaderText', config.reportHeaderText);
            fd.append('reportFooterText', config.reportFooterText);
            fd.append('reportPhone', config.reportPhone);
            fd.append('reportEmail', config.reportEmail);
            fd.append('reportAddress', config.reportAddress);
            fd.append('reportPaymentTerms', config.reportPaymentTerms);
            fd.append('reportExecDays', config.reportExecDays);
            fd.append('reportValidityDays', config.reportValidityDays);
            if (logoFile) fd.append('reportLogoFile', logoFile);

            const res = await fetch('/api/report-settings', {
                method: 'POST', body: fd, credentials: 'include',
            });
            if (res.ok) {
                showToast('Configurações do relatório salvas!', 'success');
                setLogoFile(null);
                fetchConfig();
            } else {
                showToast('Erro ao salvar', 'error');
            }
        } catch { showToast('Erro de conexão', 'error'); }
        finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Configurações do Relatório</h2>
                <button onClick={handleSave} disabled={saving}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all text-sm cursor-pointer disabled:opacity-50">
                    {saving ? <Save className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Alterações
                </button>
            </div>

            {/* Logo Settings */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-blue-500" /> Logotipo do Relatório</h3>
                <div className="flex items-center gap-6">
                    <div className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden">
                        {logoPreview ? (
                            <img src={logoPreview} alt="Preview" className="w-full h-full object-contain" />
                        ) : (
                            <ImageIcon className="w-8 h-8 text-slate-300" />
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-blue-100 transition-all inline-block">
                            <Upload className="w-4 h-4 inline mr-2" /> Escolher Logo
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                        </label>
                        <p className="text-xs text-slate-400">Recomendado: PNG fundo transparente, max 2MB.</p>
                    </div>
                </div>
            </div>

            {/* Company Info */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /> Informações da Empresa</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Nome da Empresa</label>
                        <input value={config.reportCompanyName} onChange={e => setConfig({ ...config, reportCompanyName: e.target.value })}
                            placeholder="Ex: Ferreira Calhas" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Telefone</label>
                        <input value={config.reportPhone} onChange={e => setConfig({ ...config, reportPhone: e.target.value })}
                            placeholder="(11) 99999-9999" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">E-mail</label>
                        <input value={config.reportEmail} onChange={e => setConfig({ ...config, reportEmail: e.target.value })}
                            placeholder="contato@empresa.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Endereço</label>
                        <input value={config.reportAddress} onChange={e => setConfig({ ...config, reportAddress: e.target.value })}
                            placeholder="Rua Exemplo, 123 - Cidade/UF" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Texto Adicional do Cabeçalho</label>
                    <textarea value={config.reportHeaderText} onChange={e => setConfig({ ...config, reportHeaderText: e.target.value })}
                        placeholder="CNPJ, slogan, informações extras..." rows={2}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
            </div>

            {/* Condições Comerciais */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">💼 Condições Comerciais</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Forma de Pagamento</label>
                        <input value={config.reportPaymentTerms} onChange={e => setConfig({ ...config, reportPaymentTerms: e.target.value })}
                            placeholder="Ex: 50% entrada" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Prazo Execução (dias)</label>
                        <input type="number" value={config.reportExecDays} onChange={e => setConfig({ ...config, reportExecDays: e.target.value })}
                            placeholder="Ex: 5" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Validade (dias)</label>
                        <input type="number" value={config.reportValidityDays} onChange={e => setConfig({ ...config, reportValidityDays: e.target.value })}
                            placeholder="7" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /> Rodapé do Relatório</h3>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Texto do Rodapé</label>
                    <textarea value={config.reportFooterText} onChange={e => setConfig({ ...config, reportFooterText: e.target.value })}
                        placeholder="Obrigado pela preferência!" rows={2}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
            </div>

            {/* Preview Section */}
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">📋 Prévia do Layout</h3>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-3xl mx-auto">
                    {/* Header Preview */}
                    <div className="border-b-2 border-slate-100 pb-6 mb-6">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-4">
                                {logoPreview && <img src={logoPreview} alt="Logo" className="h-12 object-contain" />}
                                <div>
                                    <h4 className="font-black text-xl text-slate-900 leading-none">{config.reportCompanyName || 'SUA EMPRESA'}</h4>
                                    <p className="text-xs text-slate-500 mt-2">{config.reportAddress}</p>
                                    <p className="text-xs text-slate-500">{config.reportPhone} | {config.reportEmail}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded">ORÇAMENTO #</span>
                            </div>
                        </div>
                    </div>
                    {/* Content Placeholder */}
                    <div className="space-y-4 py-4">
                        <div className="h-4 bg-slate-50 rounded w-1/3"></div>
                        <div className="h-20 bg-slate-50 rounded w-full"></div>
                        <div className="h-4 bg-slate-50 rounded w-1/4 self-end ml-auto"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
