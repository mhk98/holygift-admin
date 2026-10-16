import { useEffect, useState } from 'react';
import { Image, Plus, Trash2 } from 'lucide-react';
import { landingPageService } from '../../services/landingPageService';

const DEFAULT_FOOTER = {
  logoUrl: '',
  companyName: 'কাফেলা',
  supportLabel: 'Customer Supports:',
  supportPhone: '+8809647-222999',
  description: 'Corporate and promotional gift item supplier in Bangladesh',
  address: '500/3 Khilgaon Niribili Society, Dhaka Bangladesh',
  quickLinksTitle: 'Quick Links',
  quickLinks: [
    { label: 'Customer Support', url: '/contact-us' },
    { label: 'All Products', url: '/products' },
    { label: 'Categories', url: '/categories' },
    { label: 'Track My Order', url: '/track-order' },
  ],
  socialLinksTitle: 'Follow Us',
  socialLinks: [
    { platform: 'facebook', label: 'facebook', url: '' },
    { platform: 'youtube', label: 'youtube', url: '' },
    { platform: 'tiktok', label: 'tiktok', url: '' },
    { platform: 'instagram', label: 'instagram', url: '' },
  ],
  importantLinksTitle: 'Important Links',
  importantLinks: [{ label: 'Refund Policy', url: '/refund-policy' }],
  paymentMethodsImageUrl: '',
  copyrightText: 'কাফেলা © 2026.',
  developerText: 'Develop by SOFT-HEXIS',
  developerUrl: '',
  status: true,
};

function readImage(file, onLoad) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onLoad(String(reader.result || ''));
  reader.readAsDataURL(file);
}

function TextField({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400"
      />
    </label>
  );
}

function LinkEditor({ title, items, onChange, social = false }) {
  const update = (index, field, value) => {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        <button
          type="button"
          onClick={() => onChange([...items, social ? { platform: '', label: '', url: '' } : { label: '', url: '' }])}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100"
        >
          <Plus size={14} /> Add Link
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className={`grid items-end gap-3 ${social ? 'md:grid-cols-[150px_1fr_1.5fr_40px]' : 'md:grid-cols-[1fr_1.5fr_40px]'}`}>
            {social && <TextField label="Platform" value={item.platform} onChange={(value) => update(index, 'platform', value)} placeholder="facebook" />}
            <TextField label="Label" value={item.label} onChange={(value) => update(index, 'label', value)} />
            <TextField label="URL" value={item.url} onChange={(value) => update(index, 'url', value)} placeholder="https://..." />
            <button
              type="button"
              title="Remove link"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImageField({ label, value, onChange }) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <div className="rounded-lg border border-dashed border-gray-300 p-3">
        <input
          type="file"
          accept="image/*"
          onChange={(event) => readImage(event.target.files?.[0], onChange)}
          className="w-full text-xs text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:text-gray-700"
        />
        <input
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Or paste image URL"
          className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-400"
        />
        {value ? <img src={value} alt={label} className="mt-3 max-h-40 max-w-full rounded border border-gray-100 bg-gray-50 object-contain" /> : (
          <div className="mt-3 flex h-20 items-center justify-center rounded bg-gray-50 text-gray-300"><Image size={22} /></div>
        )}
      </div>
    </div>
  );
}

export default function LandingPageFooterPage() {
  const [form, setForm] = useState(DEFAULT_FOOTER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    landingPageService.getFooter()
      .then((response) => {
        if (!active) return;
        const data = response?.data || {};
        setForm({ ...DEFAULT_FOOTER, ...data });
      })
      .catch((err) => { if (active) setError(err.message || 'Footer load failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const set = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await landingPageService.updateFooter(form);
      setForm({ ...DEFAULT_FOOTER, ...(response?.data || form) });
      setSuccess('Landing page footer saved successfully');
    } catch (err) {
      setError(err.message || 'Footer save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Loading footer...</div>;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-800">Landing Page Footer</h1>
        <p className="mt-1 text-xs text-gray-500">Manage footer identity, navigation, social links and payment banner.</p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</div>}
      {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-600">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-gray-800">Company Information</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <ImageField label="Footer Logo" value={form.logoUrl} onChange={(value) => set('logoUrl', value)} />
            <div className="space-y-4">
              <TextField label="Company Name" value={form.companyName} onChange={(value) => set('companyName', value)} />
              <TextField label="Support Label" value={form.supportLabel} onChange={(value) => set('supportLabel', value)} />
              <TextField label="Support Phone" value={form.supportPhone} onChange={(value) => set('supportPhone', value)} />
            </div>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
              <textarea value={form.description || ''} onChange={(event) => set('description', event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Address</span>
              <textarea value={form.address || ''} onChange={(event) => set('address', event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            </label>
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-gray-800">Section Titles</h2>
          <div className="grid gap-5 md:grid-cols-3">
            <TextField label="Quick Links Title" value={form.quickLinksTitle} onChange={(value) => set('quickLinksTitle', value)} />
            <TextField label="Social Links Title" value={form.socialLinksTitle} onChange={(value) => set('socialLinksTitle', value)} />
            <TextField label="Important Links Title" value={form.importantLinksTitle} onChange={(value) => set('importantLinksTitle', value)} />
          </div>
        </section>

        <LinkEditor title="Quick Links" items={form.quickLinks || []} onChange={(value) => set('quickLinks', value)} />
        <LinkEditor title="Social Links" items={form.socialLinks || []} onChange={(value) => set('socialLinks', value)} social />
        <LinkEditor title="Important Links" items={form.importantLinks || []} onChange={(value) => set('importantLinks', value)} />

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-gray-800">Payment & Copyright</h2>
          <ImageField label="Payment Methods Banner" value={form.paymentMethodsImageUrl} onChange={(value) => set('paymentMethodsImageUrl', value)} />
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <TextField label="Copyright Text" value={form.copyrightText} onChange={(value) => set('copyrightText', value)} />
            <TextField label="Developer Text" value={form.developerText} onChange={(value) => set('developerText', value)} />
            <TextField label="Developer URL" value={form.developerUrl} onChange={(value) => set('developerUrl', value)} />
          </div>
          <div className="mt-5">
            <span className="mb-2 block text-sm font-medium text-gray-700">Status</span>
            <button type="button" onClick={() => set('status', !form.status)} className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${form.status ? 'bg-blue-500' : 'bg-gray-300'}`}>
              <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${form.status ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
          </div>
        </section>

        <button type="submit" disabled={saving} className="rounded-lg bg-teal-500 px-7 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Footer'}
        </button>
      </form>
    </div>
  );
}
