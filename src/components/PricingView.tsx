import { useMemo, useState } from 'react';
import { AlertCircle, Bell, Check, Plus, RefreshCw, X } from 'lucide-react';
import type {
  Product,
  PurchaseRecord,
  StaffNotification,
  StaffRole,
} from '../types';
import { api } from '../lib/api';
import { formatNaira, formatRelativeTime } from '../lib/format';

interface PricingViewProps {
  shopId: string;
  products: Product[];
  purchases: PurchaseRecord[];
  notifications: StaffNotification[];
  actorName: string;
  actorRole: StaffRole;
  onRefresh: () => Promise<void>;
}

export function PricingView({
  shopId,
  products,
  purchases,
  notifications,
  actorName,
  actorRole,
  onRefresh,
}: PricingViewProps) {
  const [subTab, setSubTab] = useState<'margins' | 'purchases' | 'notifications'>('margins');
  const [priceModalProduct, setPriceModalProduct] = useState<Product | null>(null);
  const [newSellingPrice, setNewSellingPrice] = useState('');
  const [priceReason, setPriceReason] = useState('');

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseProductId, setPurchaseProductId] = useState(products[0]?.id || '');
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('10');
  const [purchaseUnitCost, setPurchaseUnitCost] = useState('');
  const [purchaseExpiry, setPurchaseExpiry] = useState('');
  const [purchaseNote, setPurchaseNote] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const reviewItems = useMemo(
    () => products.filter((p) => p.priceReviewFlag),
    [products]
  );

  const unreadPriceNotifs = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  function openPriceUpdate(product: Product, suggestedPrice?: number) {
    setPriceModalProduct(product);
    setNewSellingPrice(String(suggestedPrice ?? product.sellingPrice));
    setPriceReason(
      product.priceReviewFlag
        ? 'Reviewed after supplier cost increase'
        : 'Selling price update'
    );
    setErrorMsg('');
  }

  function openPurchaseFor(product?: Product) {
    const target = product || products[0];
    if (!target) return;
    setPurchaseProductId(target.id);
    setPurchaseSupplier(target.supplierName);
    setPurchaseUnitCost(String(target.costPrice));
    setPurchaseQty('10');
    setPurchaseExpiry(target.expiryDate || '');
    setPurchaseNote('');
    setErrorMsg('');
    setShowPurchaseModal(true);
  }

  async function handleSavePrice(e: React.FormEvent) {
    e.preventDefault();
    if (!priceModalProduct) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await api.updateProduct(shopId, priceModalProduct.id, {
        sellingPrice: Number(newSellingPrice),
        actorName,
        actorRole,
        reason: priceReason.trim() || 'Selling price updated',
      });
      setPriceModalProduct(null);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update price');
    } finally {
      setBusy(false);
    }
  }

  async function handleDismissReview(product: Product) {
    setBusy(true);
    try {
      await api.dismissPriceReview(shopId, product.id, { actorName, actorRole });
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRecordPurchase(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      await api.recordPurchase(shopId, {
        productId: purchaseProductId,
        supplierName: purchaseSupplier,
        quantity: Number(purchaseQty),
        unitCost: Number(purchaseUnitCost),
        expiryDate: purchaseExpiry || null,
        note: purchaseNote,
        actorName,
        actorRole,
      });
      setShowPurchaseModal(false);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record purchase');
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkRead() {
    await api.markNotificationsRead(shopId);
    await onRefresh();
  }

  return (
    <div className="space-y-6">
      {/* Price Review Assistant Banner */}
      {reviewItems.length > 0 && (
        <section className="bg-white border border-amber-300 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-amber-50/70 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900">
                Price review assistant ({reviewItems.length} item{reviewItems.length === 1 ? '' : 's'} flagged)
              </h2>
            </div>
            <p className="text-xs text-amber-800">
              Supplier costs rose without a selling price review. Recommendations require your approval.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {reviewItems.map((item) => {
              const currentMargin =
                item.sellingPrice > 0
                  ? ((item.sellingPrice - item.costPrice) / item.sellingPrice) * 100
                  : 0;
              // Suggest a rounded price targeting ~15% gross margin
              const suggestedPrice = Math.ceil((item.costPrice / 0.85) / 50) * 50;
              return (
                <div
                  key={item.id}
                  className="px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.name} ({item.packSize})
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {item.priceReviewReason || `Supplier cost is ${formatNaira(item.costPrice)}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                      Cost: {formatNaira(item.costPrice)} · Current price: {formatNaira(item.sellingPrice)} · Margin:{' '}
                      <span className={currentMargin < 10 ? 'text-red-600 font-semibold' : 'text-amber-700 font-semibold'}>
                        {currentMargin.toFixed(1)}%
                      </span>{' '}
                      · Suggested review: {formatNaira(suggestedPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDismissReview(item)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                    >
                      Keep {formatNaira(item.sellingPrice)}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openPriceUpdate(item, suggestedPrice)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 whitespace-nowrap cursor-pointer"
                    >
                      Review &amp; Update Price
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Sub-navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {[
            { id: 'margins', label: 'Prices & gross margins' },
            { id: 'purchases', label: `Purchase history (${purchases.length})` },
            {
              id: 'notifications',
              label: `Staff alerts${unreadPriceNotifs > 0 ? ` (${unreadPriceNotifs})` : ''}`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as 'margins' | 'purchases' | 'notifications')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => openPurchaseFor()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Supplier Purchase
        </button>
      </div>

      {/* Tab 1: Prices & Gross Margin Table */}
      {subTab === 'margins' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Product · Supplier</th>
                  <th className="py-3 px-4 text-right">Cost price</th>
                  <th className="py-3 px-4 text-right">Previous price</th>
                  <th className="py-3 px-4 text-right">Current price</th>
                  <th className="py-3 px-4 text-right">Gross margin</th>
                  <th className="py-3 px-4">Last price update</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {products.map((product) => {
                  const profit = product.sellingPrice - product.costPrice;
                  const marginPct =
                    product.sellingPrice > 0 ? (profit / product.sellingPrice) * 100 : 0;
                  const lowMargin = marginPct < 10;
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">
                          {product.name}{' '}
                          <span className="font-normal text-slate-500">({product.packSize})</span>
                        </p>
                        <p className="text-xs text-slate-500">{product.supplierName}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">
                        {formatNaira(product.costPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400 tabular-nums">
                        {product.previousSellingPrice !== null
                          ? formatNaira(product.previousSellingPrice)
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatNaira(product.sellingPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span
                          className={
                            profit < 0
                              ? 'text-red-600 font-semibold'
                              : lowMargin
                              ? 'text-amber-600 font-semibold'
                              : 'text-emerald-700 font-semibold'
                          }
                        >
                          {marginPct.toFixed(1)}%
                        </span>
                        <p className="text-[11px] text-slate-500">
                          {formatNaira(profit)} / {product.unit.replace(/s$/, '')}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                        <p>{formatRelativeTime(product.lastPriceUpdateAt)}</p>
                        {product.priceReviewFlag && (
                          <p className="text-[11px] font-medium text-amber-700">Review flagged</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openPriceUpdate(product)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Update price
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Purchase History */}
      {subTab === 'purchases' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {purchases.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No supplier purchases recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">Product · Supplier</th>
                    <th className="py-3 px-4 text-right">Qty purchased</th>
                    <th className="py-3 px-4 text-right">Unit cost</th>
                    <th className="py-3 px-4 text-right">Total invoice</th>
                    <th className="py-3 px-4">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{p.productName}</p>
                        <p className="text-xs text-slate-500">
                          {p.supplierName}
                          {p.note ? ` · ${p.note}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {p.quantity} {p.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span className="font-medium text-slate-900">{formatNaira(p.unitCost)}</span>
                        {p.costIncreased && (
                          <p className="text-[11px] text-amber-700">
                            Up from {formatNaira(p.previousCostPrice)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatNaira(p.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                        <p>{formatRelativeTime(p.createdAt)}</p>
                        <p className="text-[11px] text-slate-400">by {p.recordedBy}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Price-Change Staff Notifications */}
      {subTab === 'notifications' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Authorised staff notifications
              </h3>
            </div>
            {unreadPriceNotifs > 0 && (
              <button
                type="button"
                onClick={handleMarkRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No price-change notifications yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <div key={n.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {n.title}
                      {!n.read && (
                        <span className="ml-2 text-[11px] font-semibold text-emerald-700">
                          New
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Update Selling Price Modal */}
      {priceModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Update selling price</h3>
              <button
                type="button"
                onClick={() => setPriceModalProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePrice} className="p-5 space-y-4">
              {errorMsg && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                <p className="font-semibold text-slate-900">
                  {priceModalProduct.name} ({priceModalProduct.packSize})
                </p>
                <p className="text-slate-600 font-mono tabular-nums">
                  Supplier cost: {formatNaira(priceModalProduct.costPrice)} · Current selling price:{' '}
                  {formatNaira(priceModalProduct.sellingPrice)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New selling price (₦)
                </label>
                <input
                  required
                  min={0}
                  type="number"
                  value={newSellingPrice}
                  onChange={(e) => setNewSellingPrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
                {Number(newSellingPrice) > 0 && (
                  <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                    New gross margin:{' '}
                    {(
                      ((Number(newSellingPrice) - priceModalProduct.costPrice) /
                        Number(newSellingPrice)) *
                      100
                    ).toFixed(1)}
                    % ({formatNaira(Number(newSellingPrice) - priceModalProduct.costPrice)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason / note for audit trail
                </label>
                <input
                  type="text"
                  value={priceReason}
                  onChange={(e) => setPriceReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Saving records the previous price, updates the timestamp, notifies authorised staff, and syncs immediately to WhatsApp.
              </p>

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPriceModalProduct(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Saving...' : 'Save & Notify Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Supplier Purchase Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Log supplier purchase</h3>
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordPurchase} className="p-5 space-y-4">
              {errorMsg && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product</label>
                <select
                  value={purchaseProductId}
                  onChange={(e) => {
                    const next = products.find((p) => p.id === e.target.value);
                    setPurchaseProductId(e.target.value);
                    if (next) {
                      setPurchaseSupplier(next.supplierName);
                      setPurchaseUnitCost(String(next.costPrice));
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.packSize})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Supplier name
                </label>
                <input
                  required
                  type="text"
                  value={purchaseSupplier}
                  onChange={(e) => setPurchaseSupplier(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Quantity received
                  </label>
                  <input
                    required
                    min={1}
                    type="number"
                    value={purchaseQty}
                    onChange={(e) => setPurchaseQty(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Unit cost (₦)
                  </label>
                  <input
                    required
                    min={0}
                    type="number"
                    value={purchaseUnitCost}
                    onChange={(e) => setPurchaseUnitCost(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Batch expiry date (optional)
                </label>
                <input
                  type="date"
                  value={purchaseExpiry}
                  onChange={(e) => setPurchaseExpiry(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Invoice note (optional)
                </label>
                <input
                  type="text"
                  value={purchaseNote}
                  onChange={(e) => setPurchaseNote(e.target.value)}
                  placeholder="e.g. Supplier invoice #INV-409"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Recording...' : 'Record Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
