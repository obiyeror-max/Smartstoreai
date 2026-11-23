import { useEffect, useState } from 'react';
import { Check, CheckCircle2, Cpu, Globe, PauseCircle } from 'lucide-react';
import type { Shop, SubscriptionPlanId } from '../types';
import { api } from '../lib/api';

interface WhatsAppSettingsViewProps {
  shop: Shop;
  onRefresh: () => Promise<void>;
}

const PLANS: Array<{
  id: SubscriptionPlanId;
  name: string;
  audience: string;
  price: string;
  limits: string[];
}> = [
  {
    id: 'starter',
    name: 'Starter',
    audience: 'For single provision stores',
    price: '₦5,000 / month',
    limits: ['1 shop location', 'Up to 500 products', '3 staff WhatsApp accounts', 'Real-time price lookups'],
  },
  {
    id: 'growth',
    name: 'Growth',
    audience: 'For busy supermarkets',
    price: '₦10,000 / month',
    limits: ['1 shop location', 'Unlimited products + CSV import', '15 staff accounts + RBAC', 'Stock checks & low-stock alerts'],
  },
  {
    id: 'multi_branch',
    name: 'Multi-branch',
    audience: 'For retail chains & wholesalers',
    price: '₦25,000+ / month',
    limits: ['Multiple isolated branches', 'Unlimited staff & roles', 'Voice note queries & audit export', 'Consolidated owner reporting'],
  },
];

export function WhatsAppSettingsView({ shop, onRefresh }: WhatsAppSettingsViewProps) {
  const [whatsappNumber, setWhatsappNumber] = useState(shop.whatsappNumber);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [aiInfo, setAiInfo] = useState<{
    provider: 'groq' | 'gemini';
    textModel: string;
    audioModel: string;
  } | null>(null);

  useEffect(() => {
    setWhatsappNumber(shop.whatsappNumber);
  }, [shop.whatsappNumber]);

  useEffect(() => {
    void api
      .getHealth()
      .then((res) => setAiInfo(res.ai))
      .catch(() => {});
  }, []);

  async function saveNumber(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedNotice('');
    try {
      await api.updateShopConfig(shop.id, { whatsappNumber });
      await onRefresh();
      setSavedNotice('WhatsApp Business number updated.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleConnection() {
    setSaving(true);
    try {
      await api.updateShopConfig(shop.id, { whatsappConnected: !shop.whatsappConnected });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function selectPlan(planId: SubscriptionPlanId) {
    setSaving(true);
    try {
      await api.updateShopConfig(shop.id, { planId });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* WhatsApp Cloud API & Sandbox Connection */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              WhatsApp Business Platform connection
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Messages from the in-app simulator and external Meta Cloud API webhooks route through the exact same handler.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={toggleConnection}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              shop.whatsappConnected
                ? 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50'
                : 'text-white bg-emerald-600 border-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {shop.whatsappConnected ? (
              <>
                <PauseCircle className="w-4 h-4 text-amber-600" />
                Pause Assistant
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Reconnect Assistant
              </>
            )}
          </button>
        </div>

        <form onSubmit={saveNumber} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Connected shop WhatsApp number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Save Number
              </button>
            </div>
            {savedNotice && <p className="mt-1.5 text-xs text-emerald-700">{savedNotice}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Drop-in Meta webhook endpoint
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">POST /api/whatsapp/webhook</span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Active mode: Hackathon Browser Sandbox · Tenant ID <span className="font-mono">{shop.id}</span>
            </p>
          </div>
        </form>

        {aiInfo && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Active NLU engine:{' '}
                <strong className="text-slate-900">
                  {aiInfo.provider === 'groq' ? 'Groq Free Tier' : 'Gemini'}
                </strong>{' '}
                <span className="font-mono text-slate-500">
                  ({aiInfo.textModel} · {aiInfo.audioModel})
                </span>
              </span>
            </div>
            {aiInfo.provider !== 'groq' && (
              <span className="text-[11px] text-slate-500">
                Set <span className="font-mono">GROQ_API_KEY</span> in your server environment variables to switch to Groq.
              </span>
            )}
          </div>
        )}
      </section>

      {/* Subscription Plans */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">SaaS subscription plan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Switch plans to test Sabi AI&apos;s multi-tier retail pricing structure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = shop.planId === plan.id;
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl p-5 border flex flex-col justify-between ${
                  isCurrent ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-xs font-semibold text-emerald-700">Current plan</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{plan.audience}</p>
                  <p className="mt-4 text-xl font-semibold text-slate-900 font-mono tabular-nums">
                    {plan.price}
                  </p>
                  <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {plan.limits.map((limit) => (
                      <li key={limit} className="flex items-start gap-2 text-xs text-slate-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{limit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={isCurrent || saving}
                  onClick={() => selectPlan(plan.id)}
                  className={`mt-6 w-full py-2 px-4 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-500 cursor-default'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isCurrent ? 'Active Plan' : `Switch to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
