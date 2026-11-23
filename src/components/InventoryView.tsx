import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Minus, Plus, X } from 'lucide-react';
import type {
  Product,
  StaffRole,
  StockAdjustmentReason,
  StockLossRecord,
} from '../types';
import { api } from '../lib/api';
import { formatNaira, formatRelativeTime } from '../lib/format';

interface InventoryViewProps {
  shopId: string;
  products: Product[];
  stockLosses: StockLossRecord[];
  actorName: string;
  actorRole: StaffRole;
  onRefresh: () => Promise<void>;
}

function getExpiryMeta(expiryDate: string | null): {
  status: 'none' | 'ok' | 'soon' | 'expired';
  daysLeft: number | null;
  label: string;
} {
  if (!expiryDate) return { status: 'none', daysLeft: null, label: 'No expiry' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft < 0) {
    return {
      status: 'expired',
      daysLeft,
      label: `Expired ${Math.abs(daysLeft)}d ago (${expiryDate})`,
    };
  }
  if (daysLeft <= 30) {
    return {
      status: 'soon',
      daysLeft,
      label: `Expires in ${daysLeft}d (${expiryDate})`,
    };
  }
  return { status: 'ok', daysLeft, label: expiryDate };
}

export function InventoryView({
  shopId,
  products,
  stockLosses,
  actorName,
  actorRole,
  onRefresh,
}: InventoryViewProps) {
  const [filter, setFilter] = useState<'all' | 'low' | 'expiring' | 'losses' | 'count'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Stock loss / reasoned adjustment modal
  const [lossModalProduct, setLossModalProduct] = useState<Product | null>(null);
  const [lossQty, setLossQty] = useState('1');
  const [lossReason, setLossReason] = useState<StockAdjustmentReason>('damaged');
  const [lossNote, setLossNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Physical stock-counting mode state
  const [countedMap, setCountedMap] = useState<Record<string, string>>({});
  const [countResult, setCountResult] = useState<{
    adjustedCount: number;
    totalVarianceUnits: number;
    totalShrinkageValue: number;
  } | null>(null);

  const expiringProducts = useMemo(() => {
    return products.filter((p) => {
      const m = getExpiryMeta(p.expiryDate);
      return m.status === 'expired' || m.status === 'soon';
    });
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (filter === 'low') return products.filter((p) => p.stockQuantity <= p.reorderLevel);
    if (filter === 'expiring') return expiringProducts;
    return products;
  }, [products, filter, expiringProducts]);

  async function adjustStock(product: Product, delta: number, reason: StockAdjustmentReason) {
    const nextQty = Math.max(0, product.stockQuantity + delta);
    if (nextQty === product.stockQuantity) return;
    setBusyId(product.id);
    try {
      await api.recordStockLoss(shopId, {
        productId: product.id,
        quantityDelta: delta,
        reason,
        actorName,
        actorRole,
      });
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  function openLossModal(product: Product, defaultReason: StockAdjustmentReason = 'damaged') {
    setLossModalProduct(product);
    setLossQty('1');
    setLossReason(defaultReason);
    setLossNote('');
  }

  async function handleSaveLossOrAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!lossModalProduct) return;
    const qty = Math.max(1, Math.floor(Number(lossQty) || 1));
    const signedDelta = lossReason === 'restock' ? qty : -qty;
    setSubmitting(true);
    try {
      await api.recordStockLoss(shopId, {
        productId: lossModalProduct.id,
        quantityDelta: signedDelta,
        reason: lossReason,
        note: lossNote,
        actorName,
        actorRole,
      });
      setLossModalProduct(null);
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  function enterCountMode() {
    const initial: Record<string, string> = {};
    for (const p of products) {
      initial[p.id] = String(p.stockQuantity);
    }
    setCountedMap(initial);
    setCountResult(null);
    setFilter('count');
  }

  const countVariances = useMemo(() => {
    return products.map((p) => {
      const counted = Math.max(0, Math.floor(Number(countedMap[p.id] ?? p.stockQuantity) || 0));
      const variance = counted - p.stockQuantity;
      return {
        product: p,
        expected: p.stockQuantity,
        counted,
        variance,
        costImpact: variance * p.costPrice,
      };
    });
  }, [products, countedMap]);

  async function handleCommitStockCount() {
    setSubmitting(true);
    try {
      const payload = countVariances.map((v) => ({
        productId: v.product.id,
        countedQuantity: v.counted,
      }));
      const res = await api.submitStockCount(shopId, {
        counts: payload,
        actorName,
        actorRole,
      });
      setCountResult({
        adjustedCount: res.adjustedCount,
        totalVarianceUnits: res.totalVarianceUnits,
        totalShrinkageValue: res.totalShrinkageValue,
      });
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  const totalLossValue = useMemo(
    () => stockLosses.reduce((sum, l) => sum + l.estimatedLossValue, 0),
    [stockLosses]
  );

  return (
    <div className="space-y-6">
      {/* Top Filter & Stock Count Trigger */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {[
            { id: 'all', label: `All stock (${products.length})` },
            {
              id: 'low',
              label: `Low stock (${products.filter((p) => p.stockQuantity <= p.reorderLevel).length})`,
            },
            {
              id: 'expiring',
              label: `Expiring / expired (${expiringProducts.length})`,
            },
            {
              id: 'losses',
              label: `Loss ledger (${stockLosses.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab.id
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
          onClick={() => (filter === 'count' ? setFilter('all') : enterCountMode())}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            filter === 'count'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          {filter === 'count' ? 'Exit Stock Counting' : 'Physical Stock Count'}
        </button>
      </div>

      {/* Physical Stock-Counting Mode */}
      {filter === 'count' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Physical stock-counting mode
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter physical shelf counts to detect variances, theft, or unrecorded sales before committing.
              </p>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={handleCommitStockCount}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {submitting ? 'Reconciling...' : 'Reconcile & Save Count'}
            </button>
          </div>

          {countResult && (
            <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Stock count reconciled: {countResult.adjustedCount} item(s) adjusted · Net variance{' '}
                <strong className="font-mono">{countResult.totalVarianceUnits}</strong> units ·
                Shrinkage cost impact{' '}
                <strong className="font-mono">{formatNaira(countResult.totalShrinkageValue)}</strong>.
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">Expected stock</th>
                  <th className="py-3 px-4 text-right">Physical count</th>
                  <th className="py-3 px-4 text-right">Variance</th>
                  <th className="py-3 px-4 text-right">Cost impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {countVariances.map(({ product, expected, counted, variance, costImpact }) => (
                  <tr key={product.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.packSize}</p>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600 tabular-nums">
                      {expected} {product.unit}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <input
                        type="number"
                        min={0}
                        aria-label={`Counted quantity for ${product.name}`}
                        value={countedMap[product.id] ?? String(counted)}
                        onChange={(e) =>
                          setCountedMap((prev) => ({ ...prev, [product.id]: e.target.value }))
                        }
                        className="w-24 px-2.5 py-1 text-right text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums">
                      <span
                        className={
                          variance < 0
                            ? 'text-red-600'
                            : variance > 0
                            ? 'text-emerald-700'
                            : 'text-slate-400'
                        }
                      >
                        {variance > 0 ? `+${variance}` : variance} {product.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums">
                      <span className={costImpact < 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                        {variance === 0 ? '—' : formatNaira(costImpact)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Stock Loss Ledger */}
      {filter === 'losses' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900">
                Damaged, expired &amp; shrinkage ledger
              </h2>
            </div>
            <p className="text-xs text-slate-600 font-mono tabular-nums">
              Recorded loss value: <strong className="text-red-600">{formatNaira(totalLossValue)}</strong>
            </p>
          </div>
          {stockLosses.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No stock losses or write-offs recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Loss reason</th>
                    <th className="py-3 px-4 text-right">Quantity lost</th>
                    <th className="py-3 px-4 text-right">Cost loss</th>
                    <th className="py-3 px-4">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {stockLosses.map((loss) => (
                    <tr key={loss.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{loss.productName}</p>
                        <p className="text-xs text-slate-500">{loss.reason}</p>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-red-700 capitalize">
                        {loss.lossType.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                        {loss.quantity} {loss.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-red-600 tabular-nums">
                        {formatNaira(loss.estimatedLossValue)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                        <p>{formatRelativeTime(loss.createdAt)}</p>
                        <p className="text-[11px] text-slate-400">by {loss.recordedBy}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Standard / Low / Expiring Inventory Table */}
      {filter !== 'count' && filter !== 'losses' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {visibleProducts.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No items match this inventory filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Expiry status</th>
                    <th className="py-3 px-4 text-right">Recorded stock</th>
                    <th className="py-3 px-4 text-right">Quick adjust &amp; loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {visibleProducts.map((product) => {
                    const isOut = product.stockQuantity === 0;
                    const isLow =
                      product.stockQuantity > 0 && product.stockQuantity <= product.reorderLevel;
                    const exp = getExpiryMeta(product.expiryDate);
                    const isBusy = busyId === product.id;

                    return (
                      <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">
                            {product.packSize} · {product.sku} · Reorder ≤ {product.reorderLevel}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono tabular-nums">
                          <span
                            className={
                              exp.status === 'expired'
                                ? 'text-red-600 font-semibold'
                                : exp.status === 'soon'
                                ? 'text-amber-700 font-semibold'
                                : 'text-slate-500'
                            }
                          >
                            {exp.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          <span
                            className={
                              isOut
                                ? 'text-red-600 font-semibold'
                                : isLow
                                ? 'text-amber-600 font-semibold'
                                : 'text-slate-900 font-medium'
                            }
                          >
                            {product.stockQuantity} {product.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy || product.stockQuantity === 0}
                              onClick={() => adjustStock(product, -1, 'sale')}
                              title="Sold 1 unit"
                              className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-40 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => adjustStock(product, 1, 'restock')}
                              title="Restock 1 unit"
                              className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-40 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy || product.stockQuantity === 0}
                              onClick={() =>
                                openLossModal(
                                  product,
                                  exp.status === 'expired' ? 'expired' : 'damaged'
                                )
                              }
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Record loss / reason
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
      )}

      {/* Record Stock Loss / Reasoned Adjustment Modal */}
      {lossModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Record stock loss or adjustment
              </h3>
              <button
                type="button"
                onClick={() => setLossModalProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveLossOrAdjustment} className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-0.5">
                <p className="font-semibold text-slate-900">
                  {lossModalProduct.name} ({lossModalProduct.packSize})
                </p>
                <p className="text-slate-600 font-mono tabular-nums">
                  Current stock: {lossModalProduct.stockQuantity} {lossModalProduct.unit} · Unit cost:{' '}
                  {formatNaira(lossModalProduct.costPrice)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Adjustment reason
                </label>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value as StockAdjustmentReason)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                >
                  <option value="damaged">Damaged goods (deduct &amp; log loss)</option>
                  <option value="expired">Expired stock write-off (deduct &amp; log loss)</option>
                  <option value="theft_or_missing">Theft / missing units (deduct &amp; log loss)</option>
                  <option value="sale">Unrecorded sale (deduct)</option>
                  <option value="restock">Supplier restock (add)</option>
                  <option value="correction">Manual record correction (deduct)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Quantity ({lossModalProduct.unit})
                </label>
                <input
                  required
                  min={1}
                  type="number"
                  value={lossQty}
                  onChange={(e) => setLossQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
                {['damaged', 'expired', 'theft_or_missing'].includes(lossReason) && (
                  <p className="mt-1 text-xs text-red-600 font-mono tabular-nums">
                    Estimated cost loss:{' '}
                    {formatNaira((Number(lossQty) || 0) * lossModalProduct.costPrice)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  value={lossNote}
                  onChange={(e) => setLossNote(e.target.value)}
                  placeholder="e.g. Torn bag in back store / expired batch"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLossModalProduct(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Confirm Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
