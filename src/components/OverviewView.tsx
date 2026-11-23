import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  Package,
  XCircle,
} from 'lucide-react';
import type { DashboardSnapshot } from '../types';
import { formatNaira, formatRelativeTime } from '../lib/format';

interface OverviewViewProps {
  snapshot: DashboardSnapshot;
  onNavigate: (
    tab: 'products' | 'pricing' | 'inventory' | 'staff' | 'activity' | 'whatsapp'
  ) => void;
  onQuickPrompt: (prompt: string) => void;
}

export function OverviewView({ snapshot, onNavigate, onQuickPrompt }: OverviewViewProps) {
  const { shop, products, activities, notifications, stats } = snapshot;

  const lowStockProducts = products
    .filter((p) => p.stockQuantity <= p.reorderLevel)
    .sort((a, b) => a.stockQuantity - b.stockQuantity)
    .slice(0, 5);

  const attentionAlerts = products.filter((p) => {
    if (p.priceReviewFlag) return true;
    if (!p.expiryDate) return false;
    const daysLeft = Math.ceil(
      (new Date(p.expiryDate).getTime() - Date.now()) / 86_400_000
    );
    return daysLeft <= 30;
  });

  const recentActivities = activities.slice(0, 5);
  const recentNotifications = notifications.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <section
        aria-label="Shop summary metrics"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total products · Margin</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {stats.totalProducts.toLocaleString('en-NG')}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            Avg margin {stats.avgGrossMarginPct}% · Value {formatNaira(stats.inventoryValue)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Price reviews · Expiry alerts</p>
          <p
            className={`mt-2 text-2xl font-semibold font-mono tabular-nums ${
              stats.priceReviewCount + stats.expiringSoonCount + stats.expiredCount > 0
                ? 'text-amber-600'
                : 'text-slate-900'
            }`}
          >
            {stats.priceReviewCount + stats.expiringSoonCount + stats.expiredCount}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {stats.priceReviewCount} price review · {stats.expiringSoonCount + stats.expiredCount}{' '}
            expiry
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Low stock · Loss recorded</p>
          <p
            className={`mt-2 text-2xl font-semibold font-mono tabular-nums ${
              stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {stats.lowStockCount}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {stats.outOfStockCount} out · {formatNaira(stats.totalLossValue)} loss logged
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">WhatsApp status · Enquiries</p>
          <div className="mt-2 flex items-center gap-2">
            {shop.whatsappConnected ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-lg font-semibold text-emerald-700">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span className="text-lg font-semibold text-red-700">Paused</span>
              </>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums truncate">
            {stats.enquiriesToday} enquiries today · {shop.whatsappNumber}
          </p>
        </div>
      </section>

      {/* Price Review & Expiry Alerts + Staff Notifications */}
      {(attentionAlerts.length > 0 || recentNotifications.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Price reviews &amp; expiry watch
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => onNavigate('pricing')}
                  className="text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  Pricing
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className="text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Expiry list
                </button>
              </div>
            </div>
            {attentionAlerts.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500">
                No margin reviews or expiry alerts right now.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {attentionAlerts.slice(0, 5).map((item) => {
                  const daysLeft = item.expiryDate
                    ? Math.ceil(
                        (new Date(item.expiryDate).getTime() - Date.now()) / 86_400_000
                      )
                    : null;
                  return (
                    <div
                      key={item.id}
                      className="px-5 py-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {item.name} ({item.packSize})
                        </p>
                        {item.priceReviewFlag && (
                          <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.priceReviewReason || 'Supplier cost increased'}</span>
                          </p>
                        )}
                        {daysLeft !== null && daysLeft <= 30 && (
                          <p
                            className={`text-xs mt-0.5 font-mono tabular-nums ${
                              daysLeft < 0 ? 'text-red-600 font-semibold' : 'text-amber-700'
                            }`}
                          >
                            {daysLeft < 0
                              ? `Expired ${Math.abs(daysLeft)}d ago (${item.expiryDate})`
                              : `Expires in ${daysLeft}d (${item.expiryDate})`}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate(item.priceReviewFlag ? 'pricing' : 'inventory')
                        }
                        className="text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md px-2.5 py-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Staff price-change alerts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('pricing')}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Open pricing
              </button>
            </div>
            {recentNotifications.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500">
                Staff price-change notifications will appear here.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentNotifications.map((notif) => (
                  <div key={notif.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                      <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{notif.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Live Demo Walkthrough Prompts */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Try a live attendant enquiry
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Click any sample question to send it through the WhatsApp simulator on the right using{' '}
              {shop.name}&apos;s live database.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('products')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Edit prices &amp; stock
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            'How much is Milo?',
            'Customer wants 2 Milo 400g and 1 carton of Indomie Onion, how much total?',
            'What items are expiring soon or expired?',
            'Which products are running low?',
            'How much is Samsung TV?',
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onQuickPrompt(prompt)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 hover:border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      {/* Two-Column Detail Split: Low Stock + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900">Items running low</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Manage stock
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Package className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="mt-2 text-sm text-slate-600">All products are above reorder level.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockProducts.map((item) => {
                const isOut = item.stockQuantity === 0;
                return (
                  <div
                    key={item.id}
                    className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {item.packSize} · Reorder at {item.reorderLevel} {item.unit}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-semibold font-mono tabular-nums ${
                          isOut ? 'text-red-600' : 'text-amber-600'
                        }`}
                      >
                        {item.stockQuantity} {item.unit}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isOut ? 'Out of stock' : 'Low stock'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900">Recent shop activity</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('activity')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              View full history
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-500">No enquiries or changes recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.map((act) => (
                <div key={act.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-900">{act.summary}</p>
                    <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                      {formatRelativeTime(act.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {act.actorName} ({act.actorRole}) ·{' '}
                    {act.channel === 'whatsapp' ? 'WhatsApp' : 'Dashboard'}
                    {act.detail ? ` · ${act.detail}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
