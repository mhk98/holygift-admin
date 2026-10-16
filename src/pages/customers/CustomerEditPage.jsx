import { useState } from 'react';
import { orderService } from '../../services/orderService';

export default function CustomerEditPage({ customer, onSave, onNavigate }) {
  const [form, setForm] = useState({
    customerName:     customer?.customerName     ?? '',
    customerPhone:    customer?.customerPhone    ?? '',
    customerArea:     customer?.customerArea     ?? '',
    customerDistrict: customer?.customerDistrict ?? '',
    customerNote:     customer?.customerNote     ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customer?.Id) return;
    setSaving(true);
    setError('');
    try {
      await orderService.updateOrder(customer.Id, form);
      onSave && onSave();
      onNavigate && onNavigate('customer_list');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-lg font-bold text-gray-800">Customer Edit</h1>
        <div className="flex gap-2">
          <button type="button"
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition">
            ▶ টিউটোরিয়াল দেখুন
          </button>
          <button type="button" onClick={() => onNavigate && onNavigate('customer_list')}
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
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input value={form.customerName} onChange={(e) => set('customerName', e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-red-500">*</span>
              </label>
              <input value={form.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
              <input value={form.customerArea} onChange={(e) => set('customerArea', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
              <input value={form.customerDistrict} onChange={(e) => set('customerDistrict', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea value={form.customerNote} onChange={(e) => set('customerNote', e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none" />
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
