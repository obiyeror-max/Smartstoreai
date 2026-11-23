import { useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import type { Product, StaffRole } from '../types';
import { formatNaira, formatRelativeTime } from '../lib/format';
import { api } from '../lib/api';

interface ProductsViewProps {
  shopId: string;
  products: Product[];
  actorName: string;
  actorRole: StaffRole;
  onRefresh: () => Promise<void>;
}

interface ProductFormState {
  name: string;
  packSize: string;
  sku: string;
  category: string;
  supplierName: string;
  costPrice: string;
  sellingPrice: string;
  stockQuantity: string;
  unit: string;
  reorderLevel: string;
  expiryDate: string;
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  packSize: '',
  sku: '',
  category: 'Beverages',
  supplierName: 'General Distributor',
  costPrice: '',
  sellingPrice: '',
  stockQuantity: '',
  unit: 'tins',
  reorderLevel: '5',
  expiryDate: '',
};

const SAMPLE_CSV = `name,packSize,sku,category,costPrice,sellingPrice,supplierName,stockQuantity,unit,reorderLevel,expiryDate
Bournvita,500 g jar,BOURN-500,Beverages,3550,4200,Cadbury Nigeria,14,jars,5,2027-06-15
Golden Penny Pasta,500 g pack,GP-PASTA-500,Noodles & Pasta,950,1150,Flour Mills,30,packs,10,2027-04-10
Three Crowns Milk,160 g tin,3CROWNS-160,Dairy,710,850,FrieslandCampina,24,tins,8,2026-12-20`;

export function ProductsView({
  shopId,
  products,
  actorName,
  actorRole,
  onRefresh,
}: ProductsViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.category))).sort();
    return ['All', ...unique];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.packSize.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryFilter]);

  function openAdd() {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setErrorMsg('');
    setShowAddModal(true);
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      packSize: product.packSize,
      sku: product.sku,
      category: product.category,
      supplierName: product.supplierName,
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      stockQuantity: String(product.stockQuantity),
      unit: product.unit,
      reorderLevel: String(product.reorderLevel),
      expiryDate: product.expiryDate || '',
    });
    setErrorMsg('');
    setShowAddModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      if (editingProduct) {
        await api.updateProduct(shopId, editingProduct.id, {
          name: form.name,
          packSize: form.packSize,
          sku: form.sku,
          category: form.category,
          supplierName: form.supplierName,
          costPrice: form.costPrice ? Number(form.costPrice) : undefined,
          sellingPrice: Number(form.sellingPrice),
          stockQuantity: Number(form.stockQuantity),
          unit: form.unit,
          reorderLevel: Number(form.reorderLevel),
          expiryDate: form.expiryDate || null,
          actorName,
          actorRole,
          reason: 'Edited in Products catalogue',
        });
      } else {
        await api.createProduct(shopId, {
          name: form.name,
          packSize: form.packSize,
          sku: form.sku,
          category: form.category,
          supplierName: form.supplierName,
          costPrice: form.costPrice ? Number(form.costPrice) : undefined,
          sellingPrice: Number(form.sellingPrice),
          stockQuantity: Number(form.stockQuantity),
          unit: form.unit,
          reorderLevel: Number(form.reorderLevel),
          expiryDate: form.expiryDate || null,
          actorName,
          actorRole,
        });
      }
      setShowAddModal(false);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(product: Product) {
    try {
      await api.deleteProduct(shopId, product.id);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete product');
    }
  }

  async function handleCsvImport(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        throw new Error('Provide a header row and at least one product row.');
      }
      const dataLines = lines[0].toLowerCase().startsWith('name,') ? lines.slice(1) : lines;
      const items = dataLines.map((line) => {
        const [
          name,
          packSize,
          sku,
          category,
          costPrice,
          sellingPrice,
          supplierName,
          stockQuantity,
          unit,
          reorderLevel,
          expiryDate,
        ] = line.split(',').map((cell) => cell.trim());
        return {
          name: name || '',
          packSize: packSize || 'Standard',
          sku: sku || '',
          category: category || 'General',
          costPrice: costPrice ? Number(costPrice) : undefined,
          sellingPrice: Number(sellingPrice) || 0,
          supplierName: supplierName || 'General Distributor',
          stockQuantity: Number(stockQuantity) || 0,
          unit: unit || 'units',
          reorderLevel: Number(reorderLevel) || 5,
          expiryDate: expiryDate || null,
        };
      });
      await api.importProducts(shopId, { items, actorName, actorRole });
      setShowImportModal(false);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product, pack size, SKU, or supplier..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categoryFilter === cat
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">No matching products found</p>
            <p className="mt-1 text-xs text-slate-500">
              Adjust your search filter or add a new product to this shop&apos;s catalogue.
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Product · Supplier</th>
                  <th className="py-3 px-4">SKU · Category</th>
                  <th className="py-3 px-4 text-right">Cost · Selling price</th>
                  <th className="py-3 px-4 text-right">Stock · Expiry</th>
                  <th className="py-3 px-4">Last updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((product) => {
                  const isOut = product.stockQuantity === 0;
                  const isLow =
                    product.stockQuantity > 0 && product.stockQuantity <= product.reorderLevel;
                  const marginPct =
                    product.sellingPrice > 0
                      ? ((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100
                      : 0;
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">
                          {product.name}{' '}
                          <span className="font-normal text-slate-500">({product.packSize})</span>
                        </p>
                        <p className="text-xs text-slate-500">{product.supplierName}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        <span className="font-mono text-slate-700">{product.sku}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{product.category}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <p className="font-semibold text-slate-900">
                          {formatNaira(product.sellingPrice)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Cost {formatNaira(product.costPrice)} · {marginPct.toFixed(0)}% margin
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span
                          className={
                            isOut
                              ? 'text-red-600 font-semibold'
                              : isLow
                              ? 'text-amber-600 font-semibold'
                              : 'text-slate-900'
                          }
                        >
                          {product.stockQuantity} {product.unit}
                        </span>
                        <p className="text-[11px] text-slate-500">
                          {product.expiryDate ? `Exp ${product.expiryDate}` : 'No expiry'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                        <p>{formatRelativeTime(product.updatedAt)}</p>
                        <p className="text-[11px] text-slate-400">by {product.updatedBy}</p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            aria-label={`Edit ${product.name}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            aria-label={`Delete ${product.name}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-base font-semibold text-slate-900">
                {editingProduct ? 'Edit product record' : 'Add new product'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
              {errorMsg && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Product name
                  </label>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Milo"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pack size / variant
                  </label>
                  <input
                    required
                    type="text"
                    value={form.packSize}
                    onChange={(e) => setForm({ ...form, packSize: e.target.value })}
                    placeholder="e.g. 400 g tin"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="MILO-400"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <input
                    required
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Supplier name
                  </label>
                  <input
                    type="text"
                    value={form.supplierName}
                    onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Cost price (₦)
                  </label>
                  <input
                    min={0}
                    type="number"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    placeholder="3950"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Selling price (₦)
                  </label>
                  <input
                    required
                    min={0}
                    type="number"
                    value={form.sellingPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                    placeholder="4800"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Stock qty</label>
                  <input
                    required
                    min={0}
                    type="number"
                    value={form.stockQuantity}
                    onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                    placeholder="12"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unit</label>
                  <input
                    required
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="tins"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Reorder level
                  </label>
                  <input
                    required
                    min={0}
                    type="number"
                    value={form.reorderLevel}
                    onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Expiry date (optional)
                  </label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Bulk CSV product import</h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCsvImport} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Columns:{' '}
                <span className="font-mono text-slate-800">
                  name, packSize, sku, category, costPrice, sellingPrice, supplierName, stockQuantity, unit, reorderLevel, expiryDate
                </span>
              </p>
              {errorMsg && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}
              <textarea
                rows={7}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full p-3 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Importing...' : 'Import Products'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
