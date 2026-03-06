import React, { useState, useEffect } from 'react';
import { Package, Plus, Pencil, Trash2, Tag, BarChart2, DollarSign, Archive, Wrench } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function ProductsTab({ showToast }: Props) {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        stock_quantity: '',
        unit: 'm2',
        type_product: 'product' as 'product' | 'service',
    });

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/products?t=${Date.now()}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                console.log('[DEBUG_PRODUCTS] Fetched products:', data);
                if (data?.[0]?._diagnostics) {
                    console.log('[DEBUG_PRODUCTS] Available columns in DB:', data[0]._diagnostics.server_keys);
                }
                data.forEach((p: any) => console.log(`Item: ${p.name}, Type: ${p.type_product}, Tipo: ${p.tipo_produto}`));
                setProducts(data);
            }
        } catch (err) {
            console.error('[DEBUG_PRODUCTS] Fetch error:', err);
            showToast('Erro ao carregar produtos', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    const handleOpenModal = (product?: any) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name || '',
                description: product.description || '',
                price: (product.price ?? product.base_cost ?? '') !== '' ? String(product.price ?? product.base_cost ?? '') : '',
                stock_quantity: product.stock_quantity != null ? String(product.stock_quantity) : '',
                unit: product.unit || 'm2',
                type_product: product.type_product || product.tipo_produto || 'product',
            });
        } else {
            setEditingProduct(null);
            setFormData({ name: '', description: '', price: '', stock_quantity: '', unit: 'm2', type_product: 'product' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return showToast('Nome do produto é obrigatório', 'error');

        const payload = {
            name: formData.name.trim(),
            description: formData.description.trim() || formData.name.trim(),
            price: formData.price !== '' ? parseFloat(formData.price) : 0,
            stock_quantity: formData.stock_quantity !== '' ? parseFloat(formData.stock_quantity) : 0,
            type_product: formData.type_product,
            unit: formData.unit,
        };

        const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
        const method = editingProduct ? 'PUT' : 'POST';

        try {
            console.log('[DEBUG_PRODUCTS] Sending payload:', payload);
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });
            const data = await res.json();
            console.log('[DEBUG_PRODUCTS] Server response:', data);

            if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

            showToast(`Produto ${editingProduct ? 'atualizado' : 'cadastrado'} com sucesso!`, 'success');
            setIsModalOpen(false);
            setTimeout(() => fetchProducts(), 500); // Small delay to ensure DB consistency
        } catch (err: any) {
            console.error('[DEBUG_PRODUCTS] Save error:', err);
            showToast(err.message, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este produto?')) return;
        try {
            await fetch(`/api/products/${id}`, { method: 'DELETE', credentials: 'include' });
            showToast('Produto excluído', 'success');
            fetchProducts();
        } catch {
            showToast('Erro ao excluir produto', 'error');
        }
    };

    const fmt = (v: any) => v != null && v !== '' && !isNaN(parseFloat(v))
        ? `R$ ${parseFloat(v).toFixed(2)}`
        : '—';

    const inputCls = 'w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-primary transition-all outline-none text-sm';

    // Summary stats
    const totalItems = products.length;
    const productItems = products.filter(p => (p.type_product || p.tipo_produto || 'product') === 'product').length;
    const serviceItems = products.filter(p => (p.type_product || p.tipo_produto) === 'service').length;

    const TypeBadge = ({ type }: { type: string }) => (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${type === 'service'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-blue-100 text-blue-700'
            }`}>
            {type === 'service' ? <Wrench className="w-3 h-3" /> : <Package className="w-3 h-3" />}
            {type === 'service' ? 'Serviço' : 'Produto'}
        </span>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Package className="w-8 h-8 text-brand-primary" />
                    Produtos & Serviços
                </h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Novo
                </button>
            </div>

            {/* Summary Cards */}
            {!loading && products.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
                        <div className="flex items-center gap-3 mb-2">
                            <Archive className="w-5 h-5 opacity-80" />
                            <span className="text-sm opacity-80">Total</span>
                        </div>
                        <p className="text-3xl font-black">{totalItems}</p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl p-5 text-white">
                        <div className="flex items-center gap-3 mb-2">
                            <Package className="w-5 h-5 opacity-80" />
                            <span className="text-sm opacity-80">Produtos (Calhas)</span>
                        </div>
                        <p className="text-3xl font-black">{productItems}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
                        <div className="flex items-center gap-3 mb-2">
                            <Wrench className="w-5 h-5 opacity-80" />
                            <span className="text-sm opacity-80">Serviços</span>
                        </div>
                        <p className="text-3xl font-black">{serviceItems}</p>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-brand-primary border-t-white rounded-full animate-spin" />
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Package className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Nenhum produto cadastrado ainda.</p>
                </div>
            ) : (
                <>
                    {/* === MOBILE: Cards View (hidden on md+) === */}
                    <div className="md:hidden space-y-4">
                        {products.map((p, i) => (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${(p.type_product === 'service' || p.tipo_produto === 'service')
                                            ? 'bg-purple-100 text-purple-600'
                                            : 'bg-blue-100 text-blue-600'
                                            }`}>
                                            {(p.type_product === 'service' || p.tipo_produto === 'service') ? <Wrench className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 leading-tight">{p.name}</h3>
                                            <TypeBadge type={p.type_product || p.tipo_produto || 'product'} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-lg font-black text-brand-primary">{fmt(p.price ?? p.base_cost)}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">por {p.unit || 'm²'}</span>
                                    </div>
                                </div>

                                {p.description && (
                                    <p className="text-xs text-slate-500 mb-4 line-clamp-2">{p.description}</p>
                                )}

                                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                    <div className="text-xs font-bold text-slate-500">
                                        {(p.type_product === 'service' || p.tipo_produto === 'service') ? (
                                            <span className="opacity-40">Serviço s/ estoque</span>
                                        ) : (
                                            <span className={parseFloat(p.stock_quantity) <= 5 ? 'text-orange-500' : ''}>
                                                Estoque: <span className="text-slate-900">{parseFloat(p.stock_quantity || 0).toFixed(2)} {p.unit || 'm²'}</span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenModal(p)}
                                            className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-600 rounded-xl active:bg-brand-primary active:text-white transition-all">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(p.id)}
                                            className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-600 rounded-xl active:bg-red-500 active:text-white transition-all">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* === DESKTOP: Table View (hidden on mobile) === */}
                    <div className="hidden md:block overflow-hidden rounded-3xl border border-slate-100 shadow-sm bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 font-bold text-slate-600">Nome</th>
                                    <th className="px-6 py-4 font-bold text-slate-600">Tipo</th>
                                    <th className="px-6 py-4 font-bold text-slate-600">Descrição</th>
                                    <th className="px-6 py-4 font-bold text-slate-600 text-right">Preço (R$)</th>
                                    <th className="px-6 py-4 font-bold text-slate-600 text-right">Estoque (m²)</th>
                                    <th className="px-6 py-4 font-bold text-slate-600 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((p, i) => (
                                    <motion.tr
                                        key={p.id}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${(p.type_product === 'service' || p.tipo_produto === 'service')
                                                    ? 'bg-purple-100 text-purple-600'
                                                    : 'bg-brand-primary/10 text-brand-primary'
                                                    }`}>
                                                    {(p.type_product === 'service' || p.tipo_produto === 'service') ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                                </div>
                                                <span className="font-bold text-slate-800">{p.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <TypeBadge type={p.type_product || p.tipo_produto || 'product'} />
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{p.description || '—'}</td>
                                        <td className="px-6 py-4 text-right font-bold text-green-600">
                                            {fmt(p.price ?? p.base_cost)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {(p.type_product === 'service' || p.tipo_produto === 'service') ? (
                                                <span className="text-slate-400 text-xs">N/A</span>
                                            ) : (
                                                <span className={`font-bold ${parseFloat(p.stock_quantity) <= 5 ? 'text-orange-500' : 'text-slate-700'}`}>
                                                    {parseFloat(p.stock_quantity || 0).toFixed(2)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => handleOpenModal(p)}
                                                    className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-brand-primary hover:text-white transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p.id)}
                                                    className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-red-500 hover:text-white transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold">
                                    {editingProduct ? 'Editar' : 'Novo Produto / Serviço'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors text-xl">✕</button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">

                                {/* TYPE SELECTOR */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-2">Tipo *</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type_product: 'product' })}
                                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold border-2 transition-all ${formData.type_product === 'product'
                                                ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300'
                                                }`}
                                        >
                                            <Package className="w-4 h-4" />
                                            Produto (Calha)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type_product: 'service' })}
                                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold border-2 transition-all ${formData.type_product === 'service'
                                                ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/30'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-purple-300'
                                                }`}
                                        >
                                            <Wrench className="w-4 h-4" />
                                            Serviço
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-2">
                                        {formData.type_product === 'service' ? 'Nome do Serviço *' : 'Nome do Produto *'}
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        className={inputCls}
                                        placeholder={formData.type_product === 'service' ? 'Ex: Instalação de Calha' : 'Ex: Calha Zinco 3m'}
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 ml-2">Descrição (Opcional)</label>
                                    <input
                                        type="text"
                                        className={inputCls}
                                        placeholder={formData.type_product === 'service' ? 'Descreva o serviço prestado...' : 'Descrição detalhada do produto...'}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-2">
                                            {formData.type_product === 'service' ? 'Valor Padrão (R$)' : 'Preço (R$)'}
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className={`${inputCls} pl-10`}
                                                placeholder="0,00"
                                                value={formData.price}
                                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    {formData.type_product === 'product' && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-2">Estoque (m²)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className={inputCls}
                                                placeholder="0.00"
                                                value={formData.stock_quantity}
                                                onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })}
                                            />
                                        </div>
                                    )}
                                    {formData.type_product === 'service' && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-2">Unidade</label>
                                            <select
                                                className={inputCls}
                                                value={formData.unit}
                                                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                            >
                                                <option value="un">Unidade</option>
                                                <option value="m">Metro</option>
                                                <option value="m2">m²</option>
                                                <option value="hr">Hora</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {formData.type_product === 'service' && (
                                    <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm text-purple-700">
                                        <strong>💡 Serviço:</strong> Na tela de orçamento, o sistema pedirá a descrição e o valor, sem solicitar mediões de dobras.
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-4 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors w-full md:w-auto"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-8 py-4 rounded-2xl font-bold bg-brand-primary text-white hover:opacity-90 transition-opacity shadow-lg shadow-brand-primary/20 w-full md:flex-1"
                                    >
                                        {editingProduct ? 'Salvar Alterações' : `Cadastrar ${formData.type_product === 'service' ? 'Serviço' : 'Produto'}`}
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
