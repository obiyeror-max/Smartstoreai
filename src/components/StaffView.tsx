import { useState } from 'react';
import { Plus, ShieldCheck, UserCheck, UserX, X } from 'lucide-react';
import type { StaffMember, StaffRole } from '../types';
import { api } from '../lib/api';

interface StaffViewProps {
  shopId: string;
  shopName: string;
  staff: StaffMember[];
  actorName: string;
  onRefresh: () => Promise<void>;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  attendant: 'Attendant',
};

export function StaffView({
  shopId,
  shopName,
  staff,
  actorName,
  onRefresh,
}: StaffViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+234');
  const [role, setRole] = useState<StaffRole>('attendant');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      await api.addStaff(shopId, { name, phone, role, actorName });
      setShowAdd(false);
      setName('');
      setPhone('+234');
      setRole('attendant');
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add staff member');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(member: StaffMember, nextRole: StaffRole) {
    await api.updateStaff(shopId, member.id, { role: nextRole, actorName });
    await onRefresh();
  }

  async function handleToggleActive(member: StaffMember) {
    await api.updateStaff(shopId, member.id, { active: !member.active, actorName });
    await onRefresh();
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Authorised staff for {shopName}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Only active staff numbers listed below can query or update {shopName} on WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMsg('');
            setShowAdd(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Staff Member
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Staff member</th>
                <th className="py-3 px-4">WhatsApp phone</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Access status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900">{member.name}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                    {member.phone}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      aria-label={`Role for ${member.name}`}
                      value={member.role}
                      onChange={(e) => handleRoleChange(member, e.target.value as StaffRole)}
                      className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-emerald-600"
                    >
                      <option value="owner">Owner</option>
                      <option value="manager">Manager</option>
                      <option value="attendant">Attendant</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {member.active ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                        <UserCheck className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
                        <UserX className="w-3.5 h-3.5" />
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(member)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {member.active ? 'Suspend' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Permissions Reference Matrix */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900">Role-based permission rules</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="py-2.5 px-4 font-medium">Operation</th>
                <th className="py-2.5 px-4 font-medium">{ROLE_LABELS.attendant}</th>
                <th className="py-2.5 px-4 font-medium">{ROLE_LABELS.manager}</th>
                <th className="py-2.5 px-4 font-medium">{ROLE_LABELS.owner}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-2.5 px-4 font-medium">WhatsApp price &amp; stock enquiries</td>
                <td className="py-2.5 px-4 text-emerald-700 font-medium">Allowed</td>
                <td className="py-2.5 px-4 text-emerald-700 font-medium">Allowed</td>
                <td className="py-2.5 px-4 text-emerald-700 font-medium">Allowed</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium">Adjust stock via WhatsApp / dashboard</td>
                <td className="py-2.5 px-4 text-red-600">Blocked</td>
                <td className="py-2.5 px-4 text-emerald-700 font-medium">Allowed (with confirmation)</td>
                <td className="py-2.5 px-4 text-emerald-700 font-medium">Allowed</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium">Change selling prices</td>
                <td className="py-2.5 px-4 text-red-600">Blocked</td>
                <td className="py-2.5 px-4 text-emerald-700 font-medium">Allowed (with confirmation)</td>
                <td className="py-2.5 px-4 text-emerald-700 font-medium">Allowed</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium">Manage staff &amp; subscription plan</td>
                <td className="py-2.5 px-4 text-red-600">Blocked</td>
                <td className="py-2.5 px-4 text-red-600">Blocked</td>
                <td className="py-2.5 px-4 text-emerald-700 font-medium">Allowed</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Staff Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Register staff member</h3>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddStaff} className="p-5 space-y-4">
              {errorMsg && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full name</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Blessing Eze"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  WhatsApp phone number
                </label>
                <input
                  required
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+2348031110005"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                >
                  <option value="attendant">Attendant (Enquiries only)</option>
                  <option value="manager">Manager (Enquiries + Stock &amp; Price updates)</option>
                  <option value="owner">Owner (Full shop control)</option>
                </select>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
