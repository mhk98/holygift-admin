import { useEffect, useState } from 'react';
import { Image, Plus, Trash2 } from 'lucide-react';
import { landingPageService } from '../../services/landingPageService';

const DEFAULT_HEADER = {
  helpText: 'Need any help? Call',
  supportPhone: '+8809647-222999',
  supportText: 'Contact support',
  supportUrl: '',
  trackOrderText: '🚚 Track your order',
  followUsText: 'Follow us:',
  socialLinks: [
    { platform: 'facebook', label: 'Facebook', url: '' },
    { platform: 'youtube', label: 'YouTube', url: '' },
    { platform: 'tiktok', label: 'TikTok', url: '' },
    { platform: 'instagram', label: 'Instagram', url: '' },
  ],
  logoUrl: '',
  logoAlt: 'Website logo',
  backgroundColor: '#1d1d1b',
  textColor: '#ffffff',
  accentColor: '#fbbf24',
  status: true,
};

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}
        className={`w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 ${type === 'color' ? 'h-11 py-1' : 'py-2.5'}`} />
    </label>
  );
}

function LogoField({ value, onChange }) {
  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-gray-700">Header Logo</span>
      <div className="rounded-lg border border-dashed border-gray-300 p-3">
        <input type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])}
          className="w-full text-xs text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs" />
        <input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="Or paste image URL"
          className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-400" />
        {value ? <img src={value} alt="Header logo preview" className="mx-auto mt-3 max-h-24 max-w-full object-contain" /> : (
          <div className="mt-3 flex h-20 items-center justify-center rounded bg-gray-50 text-gray-300"><Image size={22} /></div>
        )}
      </div>
    </div>
  );
}

function SocialLinksEditor({ items, onChange }) {
  const update = (index, field, value) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">Header Social Links</h2>
        <button type="button" onClick={() => onChange([...items, { platform: '', label: '', url: '' }])}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100">
          <Plus size={14} /> Add Social Link
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="grid items-end gap-3 md:grid-cols-[150px_1fr_1.5fr_40px]">
            <Field label="Platform" value={item.platform} onChange={(value) => update(index, 'platform', value)} placeholder="facebook" />
            <Field label="Label" value={item.label} onChange={(value) => update(index, 'label', value)} />
            <Field label="URL" value={item.url} onChange={(value) => update(index, 'url', value)} placeholder="https://..." />
            <button type="button" title="Remove link" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LandingPageHeaderPage() {
  const [form, setForm] = useState(DEFAULT_HEADER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    landingPageService.getHeader()
      .then((response) => { if (active) setForm({ ...DEFAULT_HEADER, ...(response?.data || {}) }); })
      .catch((err) => { if (active) setError(err.message || 'Header load failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const set = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await landingPageService.updateHeader(form);
      setForm({ ...DEFAULT_HEADER, ...(response?.data || form) });
      setSuccess('Landing page header saved successfully');
    } catch (err) {
      setError(err.message || 'Header save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Loading header...</div>;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-800">Landing Page Header</h1>
        <p className="mt-1 text-xs text-gray-500">Manage the help bar, tracking action, social links, logo and colors.</p>
      </div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</div>}
      {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-600">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-gray-800">Top Bar Content</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Help Text" value={form.helpText} onChange={(value) => set('helpText', value)} />
            <Field label="Support Phone" value={form.supportPhone} onChange={(value) => set('supportPhone', value)} />
            <Field label="Support Link Text" value={form.supportText} onChange={(value) => set('supportText', value)} />
            <Field label="Support URL" value={form.supportUrl} onChange={(value) => set('supportUrl', value)} placeholder="/contact-us" />
            <Field label="Track Order Text" value={form.trackOrderText} onChange={(value) => set('trackOrderText', value)} />
            <Field label="Follow Us Text" value={form.followUsText} onChange={(value) => set('followUsText', value)} />
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-gray-800">Logo & Appearance</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <LogoField value={form.logoUrl} onChange={(value) => set('logoUrl', value)} />
            <div className="space-y-4">
              <Field label="Logo Alt Text" value={form.logoAlt} onChange={(value) => set('logoAlt', value)} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field type="color" label="Background" value={form.backgroundColor} onChange={(value) => set('backgroundColor', value)} />
                <Field type="color" label="Text" value={form.textColor} onChange={(value) => set('textColor', value)} />
                <Field type="color" label="Accent" value={form.accentColor} onChange={(value) => set('accentColor', value)} />
              </div>
            </div>
          </div>
        </section>

        <SocialLinksEditor items={form.socialLinks || []} onChange={(value) => set('socialLinks', value)} />

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <span className="mb-2 block text-sm font-medium text-gray-700">Status</span>
          <button type="button" onClick={() => set('status', !form.status)} className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${form.status ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${form.status ? 'translate-x-8' : 'translate-x-1'}`} />
          </button>
        </section>

        <button type="submit" disabled={saving} className="rounded-lg bg-teal-500 px-7 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Header'}
        </button>
      </form>
    </div>
  );
}
