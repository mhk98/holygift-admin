import { useState } from 'react';
import { chargeSettingService } from '../../services/websiteService';

const CHARGE_TYPE = 'delivery';

export default function WebsiteShippingChargeEditPage({ charge, onSave, onNavigate }) {
  const isEdit = Boolean(charge?.Id);
  const today  = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    note:   charge?.note   ?? '',
    amount: charge?.amount ?? '',
    date:   charge?.date   ?? today,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await chargeSettingService.update(charge.Id, CHARGE_TYPE, form);
      } else {
        await chargeSettingService.create(CHARGE_TYPE, form);
      }
      onSave && onSave();
      onNavigate && onNavigate('shipping_charge');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-lg font-bold text-gray-800">
          {isEdit ? 'Shipping Charge Edit' : 'Shipping Charge Create'}
        </h1>
        <div className="flex gap-2">
          <button type="button"
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-4 py-2 rounded-lg transition">
            ▶ টিউটোরিয়াল দেখুন
          </button>
          <button type="button" onClick={() => onNavigate && onNavigate('shipping_charge')}
            className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition">
            Manage
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Area / Note <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.note} onChange={(e) => set('note', e.target.value)} required
                placeholder="e.g. ঢাকার ভিতরে ৮০ টাকা"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
              <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} required
                placeholder="e.g. 80"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          <div>
            <button type="submit" disabled={saving}
              className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition">
              {saving ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
