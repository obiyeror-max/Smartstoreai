import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import type { AuthSessionResponse, SubscriptionPlanId } from '../types';
import { api } from '../lib/api';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onAuthenticated: (session: AuthSessionResponse) => Promise<void>;
}

export function AuthModal({
  initialMode = 'register',
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [location, setLocation] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('+234');
  const [whatsappNumber, setWhatsappNumber] = useState('+234');
  const [planId, setPlanId] = useState<SubscriptionPlanId>('starter');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const session =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.register({
              name,
              email,
              password,
              shopName: shopName.trim() || undefined,
              location: location.trim() || undefined,
              ownerPhone: ownerPhone.trim() || undefined,
              whatsappNumber: whatsappNumber.trim() || undefined,
              planId,
            });
      await onAuthenticated(session);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Lock className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {mode === 'register' ? 'Create private shop account' : 'Sign in to your shop'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'register'
                  ? 'Your products, staff phones, and WhatsApp history stay isolated to your account.'
                  : 'Access your saved shops, inventory, and WhatsApp activity.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4 flex gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer ${
              mode === 'register'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Create Account &amp; Shop
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer ${
              mode === 'login'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {errorMsg && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Your full name</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chidi Nwosu"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email address</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@myshop.ng"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password {mode === 'register' ? '(min 6 chars)' : ''}
              </label>
              <input
                required
                minLength={mode === 'register' ? 6 : 1}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="pt-3 border-t border-slate-100 space-y-4">
              <p className="text-xs font-semibold text-slate-800">First shop setup</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Shop name</label>
                  <input
                    required
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g. Nwosu Mega Stores"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">City / area</label>
                  <input
                    required
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Yaba, Lagos"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Owner WhatsApp number
                  </label>
                  <input
                    required
                    type="text"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="+2348031234567"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Shop WhatsApp Business line
                  </label>
                  <input
                    required
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+2348091234567"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Starting plan</label>
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value as SubscriptionPlanId)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                >
                  <option value="starter">Starter (₦5,000/mo)</option>
                  <option value="growth">Growth (₦10,000/mo)</option>
                  <option value="multi_branch">Multi-branch (₦25,000+/mo)</option>
                </select>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {submitting
                ? mode === 'register'
                  ? 'Creating...'
                  : 'Signing in...'
                : mode === 'register'
                ? 'Create Account & Shop'
                : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
