import { useState } from 'react';
import { X } from 'lucide-react';
import type { Shop, SubscriptionPlanId } from '../types';
import { api } from '../lib/api';

interface NewShopModalProps {
  onClose: () => void;
  onCreated: (shop: Shop) => Promise<void>;
}

export function NewShopModal({ onClose, onCreated }: NewShopModalProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Supermarket & Provisions');
  const [whatsappNumber, setWhatsappNumber] = useState('+234 805 555 0300');
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('+2348051110001');
  const [planId, setPlanId] = useState<SubscriptionPlanId>('starter');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const { shop } = await api.createShop({
        name,
        location,
        category,
        whatsappNumber,
        whatsappPhoneNumberId: whatsappPhoneNumberId.trim() || undefined,
        ownerName,
        ownerPhone,
        planId,
      });
      await onCreated(shop);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not create shop');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Create isolated shop account</h3>
            <p className="text-xs text-slate-500">
              Each shop gets its own separate product database, staff list, and WhatsApp line.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shop name</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kolawole Minimart"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
              <input
                required
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Ikeja, Lagos"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Shop WhatsApp number
              </label>
              <input
                required
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Plan</label>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Owner name</label>
              <input
                required
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Kolawole Ade"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Owner WhatsApp phone
              </label>
              <input
                required
                type="text"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Business type</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Meta Phone Number ID (optional)
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
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Creating...' : 'Create Shop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
