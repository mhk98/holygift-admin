import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, Trash2, X, Gift } from 'lucide-react';
import { scratchCardPrizeService } from '../../services/scratchCardService';
import { imageUrl } from '../../utils/assetUrl';

const EMPTY_FORM = { name: '', nameBn: '', sortOrder: '', status: 'Active' };

// Prizes the customer picks from on the storefront scratch card form.
export default function ScratchCardPrizePage() {
  const [prizes, setPrizes]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  // null = closed, {} = create, a prize row = edit.
  const [editing, setEditing] = useState(null);

  const fetchPrizes = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await scratchCardPrizeService.getAll();
      setPrizes(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrizes(); }, [fetchPrizes]);

  async function handleDelete(prize) {
    if (!window.confirm(`Delete "${prize.name}"? Claims already submitted with this prize are kept.`)) return;
    try {
      await scratchCardPrizeService.delete(prize.Id);
      fetchPrizes();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Scratch Card Prizes</h1>
          <p className="mt-1 text-xs text-gray-500">Active prizes are shown on the storefront scratch card form, in this order.</p>
        </div>
        <button type="button" onClick={() => setEditing({})}
          className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition">
          Create
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        {loading && <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>}
        {!loading && error && <div className="text-center py-10 text-red-400 text-sm">{error}</div>}
        {!loading && !error && (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-gray-500 font-semibold w-20">Order</th>
                <th className="px-6 py-3 text-left text-gray-500 font-semibold w-24">Icon</th>
                <th className="px-6 py-3 text-left text-gray-500 font-semibold">Name</th>
                <th className="px-6 py-3 text-left text-gray-500 font-semibold">Bangla Name</th>
                <th className="px-6 py-3 text-left text-gray-500 font-semibold w-32">Status</th>
                <th className="px-6 py-3 text-left text-gray-500 font-semibold w-32">Action</th>
              </tr>
            </thead>
            <tbody>
              {prizes.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No prizes yet</td></tr>
              )}
              {prizes.map((prize) => (
                <tr key={prize.Id} className="border-b border-gray-50 hover:bg-gray-50/60 transition">
                  <td className="px-6 py-3 text-gray-500">{prize.sortOrder}</td>
                  <td className="px-6 py-3">
                    {prize.image ? (
                      <img src={imageUrl(prize.image)} alt={prize.name} className="w-10 h-10 rounded border border-gray-200 object-cover" />
                    ) : (
                      <span className="w-10 h-10 rounded border border-dashed border-gray-200 flex items-center justify-center text-gray-300" title="Built-in icon">
                        <Gift size={18} />
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-800">{prize.name}</td>
                  <td className="px-6 py-3 text-gray-700">{prize.nameBn || '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-semibold ${
                      prize.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-300'
                    }`}>
                      {prize.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <button type="button" title="Edit" onClick={() => setEditing(prize)}
                        className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition">
                        <Pencil size={14} />
                      </button>
                      <button type="button" title="Delete" onClick={() => handleDelete(prize)}
                        className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <PrizeFormModal prize={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchPrizes(); }} />
      )}
    </div>
  );
}

function PrizeFormModal({ prize, onClose, onSaved }) {
  const isEdit = Boolean(prize.Id);
  const [form, setForm] = useState(() => (isEdit ? {
    name: prize.name || '',
    nameBn: prize.nameBn || '',
    sortOrder: String(prize.sortOrder ?? ''),
    status: prize.status || 'Active',
  } : EMPTY_FORM));
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);
  const previewSrc = filePreview || (!removeImage && prize.image ? imageUrl(prize.image) : '');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Prize name is required');
    setSaving(true); setError('');
    const body = new FormData();
    body.append('name', form.name.trim());
    body.append('nameBn', form.nameBn.trim());
    if (form.sortOrder !== '') body.append('sortOrder', form.sortOrder);
    body.append('status', form.status);
    if (file) body.append('image', file);
    else if (removeImage) body.append('removeImage', 'true');
    try {
      if (isEdit) await scratchCardPrizeService.update(prize.Id, body);
      else await scratchCardPrizeService.create(body);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const inputClass = 'w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">{isEdit ? 'Edit Prize' : 'Create Prize'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Name (English) *</span>
            <input value={form.name} onChange={set('name')} maxLength={64} className={inputClass} placeholder="e.g. Rice Cooker" />
            {isEdit && form.name.trim() !== prize.name && (
              <span className="block mt-1 text-[11px] text-amber-600">Claims already submitted keep the old name.</span>
            )}
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Name (Bangla)</span>
            <input value={form.nameBn} onChange={set('nameBn')} maxLength={128} className={inputClass} placeholder="যেমন: রাইস কুকার" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-gray-600 mb-1">Order</span>
              <input type="number" step="1" value={form.sortOrder} onChange={set('sortOrder')} className={inputClass} placeholder="Last" />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-600 mb-1">Status</span>
              <select value={form.status} onChange={set('status')} className={inputClass}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-600 mb-1">Icon image (optional)</span>
            <div className="flex items-center gap-3">
              {previewSrc ? (
                <img src={previewSrc} alt="" className="w-12 h-12 rounded border border-gray-200 object-cover" />
              ) : (
                <span className="w-12 h-12 rounded border border-dashed border-gray-200 flex items-center justify-center text-gray-300"><Gift size={20} /></span>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setRemoveImage(false); }}
                className="text-xs text-gray-600 flex-1 min-w-0" />
              {previewSrc && (
                <button type="button" onClick={() => { setFile(null); setRemoveImage(true); }}
                  className="text-xs font-semibold text-red-500 hover:text-red-600">Remove</button>
              )}
            </div>
            <span className="block mt-1 text-[11px] text-gray-500">Without an image the storefront shows a built-in icon.</span>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800">Cancel</button>
          <button type="submit" disabled={saving}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
