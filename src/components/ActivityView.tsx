import { useMemo, useState } from 'react';
import type { ActivityLog, ActivityType } from '../types';
import { formatRelativeTime } from '../lib/format';

interface ActivityViewProps {
  activities: ActivityLog[];
}

const TYPE_LABEL: Record<ActivityType, string> = {
  enquiry: 'WhatsApp enquiry',
  price_change: 'Price change',
  stock_adjustment: 'Stock movement',
  stock_loss: 'Stock loss',
  purchase: 'Supplier purchase',
  stock_count: 'Physical stock count',
  product_added: 'Product added',
  staff_updated: 'Staff update',
  access_denied: 'Blocked access',
};

export function ActivityView({ activities }: ActivityViewProps) {
  const [filter, setFilter] = useState<'all' | ActivityType>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter((a) => a.type === filter);
  }, [activities, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-fit">
        {[
          { id: 'all', label: `All (${activities.length})` },
          { id: 'enquiry', label: 'Enquiries' },
          { id: 'price_change', label: 'Price changes' },
          { id: 'purchase', label: 'Purchases' },
          { id: 'stock_loss', label: 'Losses' },
          { id: 'stock_count', label: 'Stock counts' },
          { id: 'access_denied', label: 'Blocked' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as 'all' | ActivityType)}
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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No activity records match this filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const isDenied = item.type === 'access_denied';
              const isPrice = item.type === 'price_change';
              return (
                <div key={item.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{item.summary}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        <span
                          className={
                            isDenied
                              ? 'text-red-600 font-medium'
                              : isPrice
                              ? 'text-amber-700 font-medium'
                              : 'text-slate-700 font-medium'
                          }
                        >
                          {TYPE_LABEL[item.type]}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>
                          {item.actorName} ({item.actorRole})
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{item.channel === 'whatsapp' ? 'WhatsApp' : 'Dashboard'}</span>
                        {item.detail ? ` · ${item.detail}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
