import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Database,
  Globe,
  PauseCircle,
  ShieldCheck,
} from 'lucide-react';
import type { HealthStatusResponse, Shop, SubscriptionPlanId } from '../types';
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
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState(
    shop.whatsappPhoneNumberId || ''
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [health, setHealth] = useState<HealthStatusResponse | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '/api/whatsapp/webhook';

  useEffect(() => {
    setWhatsappNumber(shop.whatsappNumber);
    setWhatsappPhoneNumberId(shop.whatsappPhoneNumberId || '');
  }, [shop.id, shop.whatsappNumber, shop.whatsappPhoneNumberId]);

  useEffect(() => {
    void api
      .getHealth()
      .then((res) => setHealth(res))
      .catch(() => {});
  }, []);

  async function saveNumber(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedNotice('');
    setErrorMsg('');
    try {
      await api.updateShopConfig(shop.id, {
        whatsappNumber,
        whatsappPhoneNumberId: whatsappPhoneNumberId.trim() || null,
      });
      await onRefresh();
      setSavedNotice('WhatsApp Business settings saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save WhatsApp settings.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleConnection() {
    setSaving(true);
    setErrorMsg('');
    try {
      await api.updateShopConfig(shop.id, { whatsappConnected: !shop.whatsappConnected });
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update connection status.');
    } finally {
      setSaving(false);
    }
  }

  async function selectPlan(planId: SubscriptionPlanId) {
    setSaving(true);
    setErrorMsg('');
    try {
      await api.updateShopConfig(shop.id, { planId });
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not switch plan.');
    } finally {
      setSaving(false);
    }
  }

  function copyWebhookUrl() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(webhookUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  }

  return (
    <div className="space-y-8">
      {/* WhatsApp Cloud API & Sandbox Connection */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              WhatsApp Business Cloud API connection
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Live Meta WhatsApp Cloud API webhooks and the in-app simulator run on the exact same AI handler and shop database.
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

        {errorMsg && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}

        <form onSubmit={saveNumber} className="space-y-4 pt-3 border-t border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Shop WhatsApp Business number
              </label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+234 803 555 0100"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Meta Phone Number ID (from Meta Developer Dashboard)
              </label>
              <input
                type="text"
                value={whatsappPhoneNumberId}
                onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                placeholder="e.g. 543210987654321"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Meta Webhook Callback URL (GET &amp; POST)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{webhookUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={copyWebhookUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedUrl ? 'Copied' : 'Copy URL'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3">
              {savedNotice && <p className="text-xs text-emerald-700">{savedNotice}</p>}
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save WhatsApp Settings'}
              </button>
            </div>
          </div>
        </form>

        {/* Live Environment & Database Readiness */}
        {health && (
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">
                  {health.database === 'supabase' ? 'Supabase PostgreSQL' : 'Local Fallback Store'}
                </p>
                <p className="text-slate-500 mt-0.5">
                  {health.database === 'supabase'
                    ? 'Persistent multi-tenant user & shop DB active'
                    : 'Set SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY in env'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">
                  {health.whatsapp.verifyTokenConfigured && health.whatsapp.accessTokenConfigured
                    ? 'Meta Cloud API Ready'
                    : 'Meta Cloud API Pending Env'}
                </p>
                <p className="text-slate-500 mt-0.5">
                  Verify token: {health.whatsapp.verifyTokenConfigured ? 'Set' : 'Missing'} · Outbound
                  send: {health.whatsapp.accessTokenConfigured ? 'Set' : 'Missing'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Cpu className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">
                  {health.ai.provider === 'groq' ? 'Groq Engine Active' : 'Gemini Engine Active'}
                </p>
                <p className="font-mono text-[11px] text-slate-500 mt-0.5 truncate">
                  {health.ai.textModel}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Subscription Plans */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">SaaS subscription plan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Switch plans to match your supermarket size and staff WhatsApp seats.
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
