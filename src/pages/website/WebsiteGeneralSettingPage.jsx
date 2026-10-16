import { useState, useEffect } from 'react';
import {
  Bold, Underline, Italic, AlignLeft, List, ListOrdered,
  Link, Image, Film, Maximize2, Code, HelpCircle,
} from 'lucide-react';
import { siteSettingService } from '../../services/websiteService';
import { applyDocumentFavicon, normalizeSettingData } from '../../utils/siteBranding';
import { imageUrl } from '../../utils/assetUrl';

const SETTING_TYPE = 'general';

const DEFAULT = {
  name: '', whiteLogo: null, darkLogo: null, faviconLogo: null,
  logoFile: '', faviconFile: '',
  scrollText: '', metaTitle: '', metaKeyword: '', metaDescription: '',
  marqueeText: '',
  bkashNumber: '', nagadNumber: '', rocketNumber: '',
  orderBlockLimit: '', blockTime: '', timeUnit: 'Hour', status: true,
};

function normalizeSettings(data = {}) {
  const next = { ...DEFAULT, ...normalizeSettingData(data) };
  next.whiteLogo = next.whiteLogo || next.logoFile || null;
  next.darkLogo = next.darkLogo || next.logoFile || null;
  next.faviconLogo = next.faviconLogo || next.faviconFile || null;
  next.logoFile = next.logoFile || next.darkLogo || next.whiteLogo || '';
  next.faviconFile = next.faviconFile || next.faviconLogo || '';
  next.scrollText = next.scrollText || next.marqueeText || '';
  next.marqueeText = next.marqueeText || next.scrollText || '';
  return next;
}

function ToolbarBtn({ icon }) {
  return (
    <button type="button" className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 transition">
      {icon}
    </button>
  );
}
function Sep() { return <div className="w-px h-4 bg-gray-200 mx-0.5" />; }

function RichTextEditor({ value, onChange }) {
  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <ToolbarBtn icon={<span className="text-xs font-bold">⚙</span>} /><Sep />
        <ToolbarBtn icon={<Bold size={12} />} /><ToolbarBtn icon={<Underline size={12} />} />
        <ToolbarBtn icon={<Italic size={12} />} /><Sep />
        <select className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 focus:outline-none">
          <option>sans-serif</option><option>serif</option><option>monospace</option>
        </select><Sep />
        <ToolbarBtn icon={<List size={12} />} /><ToolbarBtn icon={<ListOrdered size={12} />} />
        <ToolbarBtn icon={<AlignLeft size={12} />} /><Sep />
        <ToolbarBtn icon={<Link size={12} />} /><ToolbarBtn icon={<Image size={12} />} /><ToolbarBtn icon={<Film size={12} />} /><Sep />
        <ToolbarBtn icon={<Maximize2 size={12} />} /><ToolbarBtn icon={<Code size={12} />} /><ToolbarBtn icon={<HelpCircle size={12} />} />
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder="Enter Your Text Here" rows={4}
        className="w-full px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none" />
    </div>
  );
}

function LogoField({ label, preview, onChange }) {
  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result || '');
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label} <span className="text-red-500">*</span></label>
      <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files[0])}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200" />
      {preview
        ? <img src={imageUrl(preview)} alt="logo" className="mt-2 w-12 h-12 rounded-full object-cover border border-gray-200 shadow-sm" />
        : <div className="mt-2 w-12 h-12 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center"><span className="text-gray-300 text-xs">Logo</span></div>
      }
    </div>
  );
}

export default function WebsiteGeneralSettingPage() {
  const [form, setForm]     = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    siteSettingService.get(SETTING_TYPE)
      .then((res) => { if (res.data?.data) setForm(normalizeSettings(res.data.data)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }
  function setLogo(v) {
    setForm((p) => ({ ...p, whiteLogo: v, logoFile: v }));
  }
  function setDarkLogo(v) {
    setForm((p) => ({ ...p, darkLogo: v, logoFile: p.logoFile || v }));
  }
  function setFavicon(v) {
    setForm((p) => ({ ...p, faviconLogo: v, faviconFile: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        ...form,
        logoFile: form.logoFile || form.darkLogo || form.whiteLogo || null,
        faviconFile: form.faviconFile || form.faviconLogo || null,
        marqueeText: form.marqueeText || form.scrollText || null,
      };
      await siteSettingService.upsert(SETTING_TYPE, payload);
      setForm(normalizeSettings(payload));
      applyDocumentFavicon(payload.faviconFile);
      window.dispatchEvent(new CustomEvent('site-settings:update', { detail: payload }));
      setSuccess('Settings saved successfully');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading...</div>;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-lg font-bold text-gray-800">General Setting Update</h1>
        <button type="button" className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-4 py-2 rounded-lg transition">
          ▶ টিউটোরিয়াল দেখুন
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        {error   && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{error}</div>}
        {success && <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-600 text-xs rounded-lg">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <LogoField label="White Logo" preview={form.whiteLogo || form.logoFile} onChange={setLogo} />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <LogoField label="Dark Logo"    preview={form.darkLogo || form.logoFile}    onChange={setDarkLogo} />
            <LogoField label="Favicon Logo" preview={form.faviconLogo || form.faviconFile} onChange={setFavicon} />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frontend Logo URL / File</label>
              <input type="text" value={form.logoFile || ''} onChange={(e) => set('logoFile', e.target.value)} placeholder="https://... or uploaded file name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frontend Favicon URL / File</label>
              <input type="text" value={form.faviconFile || ''} onChange={(e) => set('faviconFile', e.target.value)} placeholder="https://... or uploaded file name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scroll Text</label>
            <RichTextEditor value={form.scrollText} onChange={(v) => { set('scrollText', v); set('marqueeText', v); }} />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title (SEO)</label>
              <input type="text" value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta Keyword (SEO)</label>
              <input type="text" value={form.metaKeyword} onChange={(e) => set('metaKeyword', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description (SEO)</label>
            <textarea value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none" />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[['bkashNumber', 'Bkash Number'], ['nagadNumber', 'Nagad Number'], ['rocketNumber', 'Rocket Number']].map(([k, label]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="text" value={form[k]} onChange={(e) => set(k, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Block Limit</label>
              <input type="text" value={form.orderBlockLimit} onChange={(e) => set('orderBlockLimit', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Block Time</label>
              <input type="text" value={form.blockTime} onChange={(e) => set('blockTime', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Unit</label>
              <input type="text" value={form.timeUnit} onChange={(e) => set('timeUnit', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <button type="button" onClick={() => set('status', !form.status)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none ${form.status ? 'bg-blue-500' : 'bg-gray-300'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${form.status ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
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
