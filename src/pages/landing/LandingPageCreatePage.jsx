import { useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, AlignLeft,
  List, ListOrdered, Link, Image, Film,
  Maximize2, Code, HelpCircle, Plus, ChevronDown, X, Eye, CheckCircle2,
} from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { landingPageService } from '../../services/landingPageService';

const TEMPLATES = [
  'Murda Moshari Offer',
  'Template Design 1',
  'Template Design 2',
  'Template Design 3',
];

function RichTextEditor({ value, onChange, placeholder = 'Enter Your Text Here' }) {
  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <ToolbarBtn icon={<span className="text-xs font-bold">⚙</span>} />
        <Sep />
        <ToolbarBtn icon={<Bold size={12} />} />
        <ToolbarBtn icon={<Underline size={12} />} />
        <ToolbarBtn icon={<Italic size={12} />} />
        <ToolbarBtn icon={<span className="text-xs font-bold">A̶</span>} />
        <Sep />
        <select className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 focus:outline-none">
          <option>sans-serif</option>
          <option>serif</option>
          <option>monospace</option>
        </select>
        <Sep />
        <ToolbarBtn icon={<span className="text-xs font-bold px-0.5" style={{ color: '#f59e0b' }}>A</span>} />
        <Sep />
        <ToolbarBtn icon={<List size={12} />} />
        <ToolbarBtn icon={<ListOrdered size={12} />} />
        <ToolbarBtn icon={<AlignLeft size={12} />} />
        <Sep />
        <ToolbarBtn icon={<span className="text-xs">⊞</span>} />
        <Sep />
        <ToolbarBtn icon={<Link size={12} />} />
        <ToolbarBtn icon={<Image size={12} />} />
        <ToolbarBtn icon={<Film size={12} />} />
        <Sep />
        <ToolbarBtn icon={<Maximize2 size={12} />} />
        <ToolbarBtn icon={<Code size={12} />} />
        <ToolbarBtn icon={<HelpCircle size={12} />} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none"
      />
    </div>
  );
}

function ToolbarBtn({ icon }) {
  return (
    <button
      type="button"
      className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
    >
      {icon}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-4 bg-gray-300 mx-0.5" />;
}

function toCountdownDateTime(value) {
  if (!value) return '';
  const normalized = String(value).trim().replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromCountdownDateTime(value) {
  if (!value) return '';
  return `${value.replace('T', ' ')}:00`;
}

function parseCountdownRange(value) {
  if (!value) return { start: '', end: '' };
  const parts = String(value).split(/\s+-\s+/);
  if (parts.length >= 2) {
    return {
      start: toCountdownDateTime(parts[0]),
      end: toCountdownDateTime(parts[1]),
    };
  }
  return { start: '', end: toCountdownDateTime(value) };
}

function buildCountdownRange(start, end) {
  const startValue = fromCountdownDateTime(start);
  const endValue = fromCountdownDateTime(end);
  return startValue && endValue ? `${startValue} - ${endValue}` : endValue;
}

function ProductSelector({ products, loading, value, onChange, required }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedProduct = products.find((product) => String(product.Id) === String(value));
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(query.trim().toLowerCase()) ||
    String(product.sku || '').toLowerCase().includes(query.trim().toLowerCase())
  );

  function handleSelect(product) {
    onChange(String(product.Id));
    setQuery('');
    setOpen(false);
  }

  function clearSelection() {
    onChange('');
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-600 focus:outline-none focus:border-blue-400"
      >
        <span className={selectedProduct ? 'text-gray-700' : 'text-gray-400'}>
          {selectedProduct?.name || (loading ? 'Loading products...' : 'Choose ...')}
        </span>
        <span className="flex items-center gap-2">
          {selectedProduct && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); clearSelection(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  clearSelection();
                }
              }}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Clear product"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={15} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <input
        tabIndex={-1}
        value={value}
        onChange={() => {}}
        required={required}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder="Search product..."
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading && <div className="px-3 py-3 text-sm text-gray-400">Loading products...</div>}
            {!loading && filteredProducts.map((product) => (
              <button
                key={product.Id}
                type="button"
                onClick={() => handleSelect(product)}
                className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-blue-50 ${
                  String(product.Id) === String(value) ? 'bg-blue-500 text-white hover:bg-blue-500' : 'text-gray-700'
                }`}
              >
                <span className="block font-semibold">{product.name}</span>
                {product.sku && <span className="block text-[11px] opacity-70">SKU: {product.sku}</span>}
              </button>
            ))}
            {!loading && filteredProducts.length === 0 && (
              <div className="px-3 py-3 text-sm text-gray-400">No product found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductOptionsManager({ products, loading, value, onChange }) {
  const selectedIds = value.map((item) => String(item.productId));

  function toggleProduct(product) {
    const id = String(product.Id);
    if (selectedIds.includes(id)) {
      onChange(value.filter((item) => String(item.productId) !== id));
      return;
    }
    onChange([
      ...value,
      {
        productId: id,
        name: product.name,
        price: getProductPrice(product),
        originalPrice: product.oldPrice || product.regularPrice || "",
        image: getProductImage(product),
      },
    ]);
  }

  function updateOption(productId, patch) {
    onChange(
      value.map((item) =>
        String(item.productId) === String(productId) ? { ...item, ...patch } : item,
      ),
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-gray-700">Checkout Product Options</p>
          <p className="text-[11px] text-gray-400">Customer can select multiple products and quantity.</p>
        </div>
        <span className="rounded bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-600">
          {value.length} selected
        </span>
      </div>
      {loading ? (
        <div className="rounded border border-gray-200 bg-white p-3 text-xs text-gray-400">Loading products...</div>
      ) : (
        <div className="grid max-h-72 gap-2 overflow-y-auto md:grid-cols-2">
          {products.map((product) => {
            const option = value.find((item) => String(item.productId) === String(product.Id));
            const checked = Boolean(option);
            return (
              <div key={product.Id} className={`rounded border bg-white p-2 ${checked ? "border-blue-400" : "border-gray-200"}`}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProduct(product)}
                    className="mt-1 accent-blue-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-gray-700">{product.name}</p>
                    <p className="text-[11px] text-gray-400">Default: ৳{getProductPrice(product) || 0}</p>
                  </div>
                </label>
                {checked && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={option.price}
                      onChange={(event) => updateOption(product.Id, { price: event.target.value })}
                      placeholder="Offer price"
                      className="rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                    />
                    <input
                      type="number"
                      value={option.originalPrice || ""}
                      onChange={(event) => updateOption(product.Id, { originalPrice: event.target.value })}
                      placeholder="Old price"
                      className="rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CarouselItemsManager({ value, onChange }) {
  function updateItem(index, patch) {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  async function setImage(index, file) {
    if (!file) return;
    const image = await fileToDataUrl(file);
    updateItem(index, { image });
  }

  function addItem() {
    onChange([
      ...value,
      {
        id: `carousel-${Date.now()}`,
        name: '',
        price: '',
        originalPrice: '',
        image: '',
      },
    ]);
  }

  function removeItem(index) {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-700">Carousel Product Cards</p>
          <p className="text-[11px] text-gray-500">These cards are shown in the sliding carousel.</p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
        >
          Add Card
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {value.map((item, index) => (
          <div key={item.id || index} className="rounded border border-emerald-100 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600">Card #{index + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-xs font-bold text-red-500 hover:text-red-600"
              >
                Remove
              </button>
            </div>
            <div className="grid gap-2">
              <input
                type="text"
                value={item.name || ''}
                onChange={(event) => updateItem(index, { name: event.target.value })}
                placeholder="Card title"
                className="rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-emerald-400"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={item.price || ''}
                  onChange={(event) => updateItem(index, { price: event.target.value })}
                  placeholder="Offer price"
                  className="rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-emerald-400"
                />
                <input
                  type="number"
                  value={item.originalPrice || ''}
                  onChange={(event) => updateItem(index, { originalPrice: event.target.value })}
                  placeholder="Old price"
                  className="rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-emerald-400"
                />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setImage(index, event.target.files?.[0])}
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs"
              />
              {item.image ? (
                <img src={item.image} alt={item.name || `Carousel card ${index + 1}`} className="h-24 w-full rounded object-cover" />
              ) : (
                <div className="rounded border border-dashed border-gray-200 px-3 py-4 text-center text-xs font-semibold text-gray-400">
                  No image selected
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPageCreatePage({ mode = 'create', campaign, onNavigate }) {
  const isEdit = mode === 'edit';
  const { data: products, loading: productsLoading } = useProducts({ limit: 200 });
  const matchedCampaignProduct = campaign?.product
    ? products.find((product) => product.name === campaign.product)
    : null;
  const [form, setForm] = useState(() => buildFormState(campaign));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const selectedProductId = form.productId || (isEdit && matchedCampaignProduct ? String(matchedCampaignProduct.Id) : '');
  const selectedProduct = products.find((product) => String(product.Id) === String(selectedProductId));

  const previewContent = {
    productName: selectedProduct?.name || matchedCampaignProduct?.name || campaign?.product || 'Campaign Product',
    title: form.campaignTitle || 'Campaign Title',
    subTitle: form.subTitle || 'Campaign subtitle will appear here',
    shortDescription: stripPreviewText(form.shortDescription || form.description || form.whyChooseUs),
    price: form.price || '0',
    originalPrice: form.originalPrice || '',
    phone: form.phone || '+880...',
    bannerImage: form.bannerImage ? URL.createObjectURL(form.bannerImage) : form.bannerImageUrl || '',
    prizeImage: form.prizeImage ? URL.createObjectURL(form.prizeImage) : form.prizeImageUrl || '',
  };

  useEffect(() => {
    if (!isEdit || !campaign?.Id) return undefined;
    let active = true;
    landingPageService.getOne(campaign.Id)
      .then((res) => {
        if (!active) return;
        setForm(buildFormState(res.data || campaign));
        setError('');
      })
      .catch((err) => {
        if (active) setError(err.message || 'Landing page detail fetch failed.');
      });
    return () => {
      active = false;
    };
  }, [campaign, isEdit]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addReviewImageSlot() {
    setForm((prev) => ({ ...prev, reviewImages: [...prev.reviewImages, null] }));
  }

  function setReviewImage(index, file) {
    setForm((prev) => {
      const updated = [...prev.reviewImages];
      updated[index] = file;
      return { ...prev, reviewImages: updated };
    });
  }

  function removeSavedReviewImage(index) {
    setForm((prev) => ({
      ...prev,
      savedReviewImages: prev.savedReviewImages.filter((_, idx) => idx !== index),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const bannerImageUrl = form.bannerImage
        ? await fileToDataUrl(form.bannerImage)
        : form.bannerImageUrl;
      const uploadedReviewImages = await Promise.all(
        form.reviewImages.filter(Boolean).map((file) => fileToDataUrl(file))
      );
      const prizeImageUrl = form.prizeImage
        ? await fileToDataUrl(form.prizeImage)
        : form.prizeImageUrl;
      const payload = {
        pageType: 'Campaign',
        productId: selectedProductId || null,
        title: form.campaignTitle,
        subTitle: form.subTitle,
        bannerImageUrl,
        prizeImageUrl,
        reviewImages: [...form.savedReviewImages, ...uploadedReviewImages],
        shortDescription: form.shortDescription,
        video: form.video,
        reviewTitle: form.reviewTitle,
        descriptionTitle: form.descriptionTitle,
        description: form.description,
        whyChooseTitle: form.whyChooseTitle,
        whyChooseUs: form.whyChooseUs,
        price: form.price,
        originalPrice: form.originalPrice,
        phone: form.phone,
        countdown: buildCountdownRange(form.countdownStart, form.countdownEnd),
        template: form.campaignTemplate,
        regularData: {
          ...parseJsonObject(campaign?.regularData),
          productOptions: normalizeProductOptions(form.productOptions),
          carouselItems: normalizeCarouselItems(form.carouselItems),
          introText: form.introText,
          offerImageTitle: form.offerImageTitle,
          ctaText: form.ctaText,
          orderTitle: form.orderTitle,
          sizeTitle: form.sizeTitle,
          deliveryInside: form.deliveryInside,
          deliveryOutside: form.deliveryOutside,
        },
        status: form.status,
      };

      if (isEdit && campaign?.Id) {
        await landingPageService.update(campaign.Id, payload);
      } else {
        await landingPageService.create(payload);
      }
      onNavigate && onNavigate('landing_manage');
    } catch (err) {
      setError(err.message || 'Landing page save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-gray-800">Landing Page {isEdit ? 'Edit' : 'Create'}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition"
          >
            ▶ টিউটোরিয়াল দেখুন
          </button>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('landing_manage')}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition"
          >
            Manage
          </button>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-500">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Products + Banner Image */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Products <span className="text-red-500">*</span>
              </label>
              <ProductSelector
                products={products}
                loading={productsLoading}
                value={selectedProductId}
                onChange={(value) => set('productId', value)}
                required={!isEdit && form.productOptions.length === 0}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Banner Image <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept="image/*"
                required={!isEdit && !form.bannerImageUrl}
                onChange={(e) => set('bannerImage', e.target.files[0] ?? null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
              />
              <ImagePreview
                src={getPreviewImageSrc(form.bannerImage, form.bannerImageUrl)}
                title={form.bannerImage ? 'New banner image' : 'Saved banner image'}
                note={form.bannerImage ? `New selected: ${form.bannerImage.name}` : 'This image is loaded from backend.'}
                aspect="wide"
              />
            </div>
          </div>

          <ProductOptionsManager
            products={products}
            loading={productsLoading}
            value={form.productOptions}
            onChange={(value) => set('productOptions', value)}
          />

          <CarouselItemsManager
            value={form.carouselItems}
            onChange={(value) => set('carouselItems', value)}
          />

          {/* Campaign Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Campaign Title
            </label>
            <input
              type="text"
              value={form.campaignTitle}
              onChange={(e) => set('campaignTitle', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Sub Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Sub Title (optional)
            </label>
            <input
              type="text"
              value={form.subTitle}
              onChange={(e) => set('subTitle', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Short Description <span className="text-red-500">*</span>
            </label>
            <RichTextEditor
              value={form.shortDescription}
              onChange={(v) => set('shortDescription', v)}
            />
          </div>

          {/* Row: Video + Review Title */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Video (Optional)
              </label>
              <input
                type="text"
                value={form.video}
                onChange={(e) => set('video', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Review Title
              </label>
              <input
                type="text"
                value={form.reviewTitle}
                onChange={(e) => set('reviewTitle', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Offer Price
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Regular Price
              </label>
              <input
                type="number"
                value={form.originalPrice}
                onChange={(e) => set('originalPrice', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                CTA Button Text
              </label>
              <input
                type="text"
                value={form.ctaText}
                onChange={(e) => set('ctaText', e.target.value)}
                placeholder="অর্ডার করতে ক্লিক করুন"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Order Form Title
              </label>
              <input
                type="text"
                value={form.orderTitle}
                onChange={(e) => set('orderTitle', e.target.value)}
                placeholder="অর্ডার করতে আপনার সঠিক তথ্য দিয়ে নিচের ফর্মটি সম্পূর্ণ পূরণ করুন।"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Inside Dhaka Delivery Charge (min 80)
              </label>
              <input
                type="number"
                min={80}
                value={form.deliveryInside}
                onChange={(e) => set('deliveryInside', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Outside Dhaka Delivery Charge (min 130)
              </label>
              <input
                type="number"
                min={130}
                value={form.deliveryOutside}
                onChange={(e) => set('deliveryOutside', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Prize Image (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => set('prizeImage', e.target.files[0] ?? null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
            />
            <ImagePreview
              src={getPreviewImageSrc(form.prizeImage, form.prizeImageUrl)}
              title={form.prizeImage ? 'New prize image' : 'Saved prize image'}
              note={form.prizeImage ? `New selected: ${form.prizeImage.name}` : 'This image is loaded from backend.'}
              aspect="wide"
            />
          </div>

          {/* Review Image(s) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Review Image (Optional)
            </label>
            {form.savedReviewImages.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {form.savedReviewImages.map((src, idx) => (
                  <div key={`${src}-${idx}`} className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    <img src={src} alt={`Saved review ${idx + 1}`} className="h-28 w-full object-cover" />
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-[11px] font-semibold text-gray-600">Review #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeSavedReviewImage(idx)}
                        className="rounded bg-red-50 p-1 text-red-500 hover:bg-red-100"
                        title="Remove saved review image"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {form.reviewImages.map((file, idx) => (
                <div key={idx} className="min-w-[220px] flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setReviewImage(idx, e.target.files[0] ?? null)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
                  />
                  {file ? (
                    <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      <img src={getPreviewImageSrc(file)} alt={`New review ${idx + 1}`} className="h-24 w-full object-cover" />
                      <p className="px-2 py-1 text-[11px] font-semibold text-gray-500">{file.name}</p>
                    </div>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={addReviewImageSlot}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Description Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Intro Text
            </label>
            <textarea
              value={form.introText}
              onChange={(e) => set('introText', e.target.value)}
              rows={2}
              placeholder="মৃত ব্যক্তির শেষ গোসলে পর্দা, পরিচ্ছন্নতা ও সম্মানের জন্য..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Description Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.descriptionTitle}
              onChange={(e) => set('descriptionTitle', e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Offer Image Title
            </label>
            <input
              type="text"
              value={form.offerImageTitle}
              onChange={(e) => set('offerImageTitle', e.target.value)}
              placeholder="তাহলে আপনার এলাকায় এই মুর্দা মশারিটি দান করুন"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Size Section Title
            </label>
            <input
              type="text"
              value={form.sizeTitle}
              onChange={(e) => set('sizeTitle', e.target.value)}
              placeholder="মুর্দা মশারি সাইজ"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <RichTextEditor
              value={form.description}
              onChange={(v) => set('description', v)}
            />
          </div>

          {/* Why Choose Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Why Choose Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.whyChooseTitle}
              onChange={(e) => set('whyChooseTitle', e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Why Choose Us */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Why Choose Us <span className="text-red-500">*</span>
            </label>
            <RichTextEditor
              value={form.whyChooseUs}
              onChange={(v) => set('whyChooseUs', v)}
            />
          </div>

          {/* Row: Countdown Time + Campaign Template */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Countdown Time
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="datetime-local"
                  value={form.countdownStart}
                  onChange={(e) => set('countdownStart', e.target.value)}
                  aria-label="Countdown start time"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
                <input
                  type="datetime-local"
                  value={form.countdownEnd}
                  onChange={(e) => set('countdownEnd', e.target.value)}
                  min={form.countdownStart || undefined}
                  aria-label="Countdown end time"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Campaign Template
              </label>
              <div className="flex gap-2">
                <select
                  value={form.campaignTemplate}
                  onChange={(e) => set('campaignTemplate', e.target.value)}
                  className="min-w-0 flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(form.campaignTemplate)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <Eye size={13} />
                  Preview
                </button>
              </div>
            </div>
          </div>

          <TemplatePicker
            content={previewContent}
            onSelect={(template) => set('campaignTemplate', template)}
            onPreview={setPreviewTemplate}
          />

          {/* Status toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Status</label>
            <button
              type="button"
              onClick={() => set('status', !form.status)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                form.status ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  form.status ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Submit */}
          <div>
            <button
              type="submit"
              disabled={saving}
              className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-6 py-2 rounded-lg transition"
            >
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Submit'}
            </button>
          </div>
        </form>
      </div>

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          selected={form.campaignTemplate}
          content={previewContent}
          onClose={() => setPreviewTemplate(null)}
          onUse={(template) => {
            set('campaignTemplate', template);
            setPreviewTemplate(null);
          }}
        />
      )}
    </div>
  );
}

function TemplatePicker({ content, onSelect, onPreview }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-700">Template Preview</label>
        <span className="text-[11px] font-semibold text-gray-400">Select before submit</span>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {TEMPLATES.map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => onSelect(template)}
              className="group overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:border-blue-300"
            >
              <TemplateThumbnail template={template} content={content} />
              <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
                <div>
                  <p className="text-xs font-bold text-gray-800">{template}</p>
                  <p className="text-[11px] text-gray-500">{getTemplateDescription(template)}</p>
                </div>
              </div>
              <div className="border-t border-gray-100 px-3 py-2">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPreview(template);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      onPreview(template);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 transition hover:bg-blue-100"
                >
                  <Eye size={12} />
                  Large preview
                </span>
              </div>
            </button>
        ))}
      </div>
    </div>
  );
}

function TemplatePreviewModal({ template, selected, content, onClose, onUse }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{template}</h2>
            <p className="text-xs text-gray-500">{getTemplateDescription(template)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close template preview"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto bg-gray-100 p-5">
          <LargeTemplatePreview template={template} content={content} />
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <span className="text-xs font-semibold text-gray-500">
            {selected === template ? 'Currently selected' : 'Preview only'}
          </span>
          <button
            type="button"
            onClick={() => onUse(template)}
            className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-green-600"
          >
            <CheckCircle2 size={14} />
            Use this template
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateThumbnail({ template, content }) {
  if (template === 'Murda Moshari Offer') {
    return (
      <div className="h-36 bg-white p-2">
        <div className="text-center text-[10px] font-black text-red-600">{content.title}</div>
        <div className="mt-1 bg-black py-1 text-center text-[13px] font-black text-white">২ টি ফ্রি গিফট!!</div>
        <div className="mt-1 bg-yellow-300 py-1 text-center text-[12px] font-black text-red-600">
          মাত্র {formatPreviewMoney(content.price)}
        </div>
        <div className="relative mx-auto mt-2 h-16 w-28 overflow-hidden rounded bg-orange-50">
          <PreviewImage src={content.bannerImage} alt={content.productName} className="absolute inset-0 h-full w-full" />
        </div>
        <div className="mx-auto mt-2 h-5 w-24 rounded bg-green-500 text-center text-[9px] font-black leading-5 text-white">
          অর্ডার করুন
        </div>
      </div>
    );
  }

  if (template === 'Giveaway Campaign') {
    return (
      <div className="h-36 bg-[#ffffff] p-3">
        <div className="mx-auto h-4 w-4 rounded-full bg-amber-500" />
        <div className="mt-2 space-y-1">
          <div className="rounded bg-yellow-100 px-2 py-1 text-center text-[9px] font-black text-red-600">
            আজই কিনুন, অফার নিন
          </div>
          <div className="rounded bg-indigo-100 px-2 py-1 text-center text-[9px] font-black text-emerald-700">
            পুরস্কার ক্যাম্পেইন
          </div>
        </div>
        <div className="relative mt-2 h-14 overflow-hidden rounded bg-[#1b130b]">
          <PreviewImage src={content.bannerImage} alt={content.productName} className="absolute inset-0 h-full w-full opacity-55" />
          <div className="relative p-2">
            <p className="line-clamp-1 text-[10px] font-black text-yellow-200">{content.productName}</p>
            <p className="mt-1 text-[15px] font-black text-yellow-300">{formatPreviewMoney(content.price)}</p>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-3 rounded bg-orange-100" />
          ))}
        </div>
      </div>
    );
  }

  if (template === 'Template Design 2') {
    return (
      <div className="h-36 bg-emerald-50 p-3">
        <div className="grid h-full grid-cols-[0.9fr_1.1fr] gap-2">
          <PreviewImage src={content.bannerImage} alt={content.productName} className="rounded bg-gradient-to-br from-emerald-300 to-slate-700" />
          <div className="min-w-0 space-y-1.5">
            <p className="inline-flex max-w-full rounded bg-emerald-200 px-2 py-0.5 text-[9px] font-black text-emerald-800">
              Premium Campaign
            </p>
            <p className="line-clamp-2 text-[12px] font-black leading-tight text-slate-950">{content.title}</p>
            <p className="line-clamp-2 text-[10px] leading-snug text-slate-600">{content.subTitle}</p>
            <div className="mt-1 flex items-center gap-1">
              <span className="rounded bg-slate-950 px-2 py-1 text-[10px] font-black text-white">{formatPreviewMoney(content.price)}</span>
              {content.originalPrice ? <span className="text-[9px] text-slate-400 line-through">{formatPreviewMoney(content.originalPrice)}</span> : null}
            </div>
            <div className="grid grid-cols-3 gap-1 pt-1">
              <div className="h-6 rounded bg-white" />
              <div className="h-6 rounded bg-white" />
              <div className="h-6 rounded bg-white" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (template === 'Template Design 3') {
    return (
      <div className="h-36 bg-slate-950 p-3">
        <div className="grid h-full grid-cols-[1fr_0.7fr] gap-2">
          <div className="relative overflow-hidden rounded bg-gradient-to-r from-slate-900 via-slate-700 to-red-500 p-3">
            <PreviewImage src={content.bannerImage} alt={content.productName} className="absolute inset-0 h-full w-full opacity-35" />
            <div className="relative">
              <p className="inline-flex rounded bg-red-400 px-2 py-0.5 text-[9px] font-black text-white">Limited</p>
              <p className="mt-2 line-clamp-2 text-[13px] font-black leading-tight text-white">{content.title}</p>
              <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-slate-200">{content.subTitle}</p>
              <div className="mt-2 inline-flex rounded bg-emerald-500 px-2 py-1 text-[10px] font-black text-white">
                {formatPreviewMoney(content.price)}
              </div>
            </div>
          </div>
          <div className="rounded bg-white p-2">
            <p className="truncate text-[10px] font-black text-slate-900">Quick Order</p>
            <div className="mt-2 space-y-1">
              <div className="h-5 rounded bg-slate-100" />
              <div className="h-5 rounded bg-slate-100" />
              <div className="h-5 rounded bg-slate-100" />
            </div>
            <div className="mt-2 h-6 rounded bg-indigo-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-36 bg-[#fafafa] p-3">
      <div className="mx-auto h-5 w-5 rounded-full bg-amber-500" />
      <div className="mt-2 rounded bg-yellow-100 p-2">
        <p className="line-clamp-1 text-center text-[10px] font-black text-red-600">{content.title}</p>
        <p className="line-clamp-1 text-center text-[9px] font-bold text-emerald-700">{content.subTitle}</p>
      </div>
      <div className="relative mt-2 overflow-hidden rounded bg-slate-900 p-3">
        <PreviewImage src={content.bannerImage} alt={content.productName} className="absolute inset-0 h-full w-full opacity-30" />
        <div className="relative">
          <p className="line-clamp-1 text-[11px] font-black text-amber-300">{content.productName}</p>
          <p className="mt-1 text-[16px] font-black text-yellow-300">{formatPreviewMoney(content.price)}</p>
          {content.originalPrice ? <p className="text-[9px] text-slate-300 line-through">{formatPreviewMoney(content.originalPrice)}</p> : null}
          <div className="mt-2 grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-5 rounded bg-amber-500" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LargeTemplatePreview({ template, content }) {
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <TemplateThumbnail template={template} content={content} />
      <div className="grid gap-4 p-5 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h3 className="text-xl font-black text-gray-900">{content.title}</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">{content.subTitle}</p>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-gray-500">{content.shortDescription}</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <MetricBox label="Product" value={content.productName} />
            <MetricBox label="Offer" value={formatPreviewMoney(content.price)} />
            <MetricBox label="Phone" value={content.phone} />
          </div>
        </div>
        <div className="rounded border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-black text-gray-900">Order Summary</p>
          <div className="mt-3 space-y-2">
            <div className="h-9 rounded bg-white" />
            <div className="h-9 rounded bg-white" />
            <div className="h-9 rounded bg-white" />
            <div className="h-10 rounded bg-indigo-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function getTemplateDescription(template) {
  if (template === 'Murda Moshari Offer') return 'Reference-style Bangla offer landing page';
  if (template === 'Giveaway Campaign') return 'Giveaway offer landing page like the reference';
  if (template === 'Template Design 2') return 'Product-focused light layout';
  if (template === 'Template Design 3') return 'Dark quick-order layout';
  return 'Classic campaign landing layout';
}

function PreviewImage({ src, alt, className }) {
  if (!src) return <div className={className} />;
  return <img src={src} alt={alt} className={`${className} object-cover`} />;
}

function MetricBox({ label, value }) {
  return (
    <div className="min-h-20 rounded border border-gray-100 bg-gray-50 p-3">
      <p className="text-[10px] font-black uppercase text-gray-400">{label}</p>
      <p className="mt-1 line-clamp-2 text-xs font-bold text-gray-800">{value}</p>
    </div>
  );
}

function formatPreviewMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '0 টাকা';
  return `${amount.toLocaleString('en-BD')} টাকা`;
}

function stripPreviewText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPreviewImageSrc(file, fallback = '') {
  return file ? URL.createObjectURL(file) : fallback;
}

function parseReviewImages(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }
}

function ImagePreview({ src, title, note, aspect = 'wide' }) {
  if (!src) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-xs font-semibold text-gray-400">
        No saved image found from backend.
      </div>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <span className="text-[11px] font-semibold text-green-600">Backend image</span>
      </div>
      <img
        src={src}
        alt={title}
        className={`w-full object-cover ${aspect === 'wide' ? 'h-36' : 'h-28'}`}
      />
      {note && <p className="px-3 py-2 text-[11px] text-gray-500">{note}</p>}
    </div>
  );
}

function buildFormState(campaign) {
  const countdownRange = parseCountdownRange(campaign?.countdown || campaign?.countdownTime || '');
  const savedTemplate = campaign?.template || campaign?.campaignTemplate || '';
  const regularData = parseJsonObject(campaign?.regularData);
  return {
    productId: campaign?.productId ? String(campaign.productId) : '',
    productOptions: normalizeProductOptions(regularData.productOptions),
    carouselItems: normalizeCarouselItems(regularData.carouselItems || regularData.productOptions),
    bannerImage: null,
    bannerImageUrl: campaign?.bannerImageUrl || '',
    prizeImage: null,
    prizeImageUrl: campaign?.prizeImageUrl || '',
    campaignTitle: campaign?.title || campaign?.campaignTitle || '',
    subTitle: campaign?.subTitle || '',
    shortDescription: campaign?.shortDescription || '',
    video: campaign?.video || '',
    reviewTitle: campaign?.reviewTitle || '',
    reviewImages: [null],
    savedReviewImages: parseReviewImages(campaign?.reviewImages),
    descriptionTitle: campaign?.descriptionTitle || '',
    description: campaign?.description || '',
    whyChooseTitle: campaign?.whyChooseTitle || '',
    whyChooseUs: campaign?.whyChooseUs || '',
    price: campaign?.price || '',
    originalPrice: campaign?.originalPrice || '',
    phone: campaign?.phone || '',
    introText: regularData.introText || '',
    offerImageTitle: regularData.offerImageTitle || '',
    ctaText: regularData.ctaText || 'অর্ডার করতে ক্লিক করুন',
    orderTitle: regularData.orderTitle || 'অর্ডার করতে আপনার সঠিক তথ্য দিয়ে নিচের ফর্মটি সম্পূর্ণ পূরণ করুন।',
    sizeTitle: regularData.sizeTitle || '',
    deliveryInside: regularData.deliveryInside || '80',
    deliveryOutside: regularData.deliveryOutside || '130',
    countdownStart: countdownRange.start,
    countdownEnd: countdownRange.end,
    campaignTemplate: TEMPLATES.includes(savedTemplate) ? savedTemplate : TEMPLATES[0],
    status: campaign?.status ?? true,
  };
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeProductOptions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      productId: item.productId ? String(item.productId) : '',
      name: String(item.name || '').trim(),
      price: item.price === undefined || item.price === null ? '' : String(item.price),
      originalPrice: item.originalPrice === undefined || item.originalPrice === null ? '' : String(item.originalPrice),
      image: item.image || '',
    }))
    .filter((item) => item.productId && item.name);
}

function normalizeCarouselItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: item.id || item.productId || `carousel-${index}`,
      name: String(item.name || '').trim(),
      price: item.price === undefined || item.price === null ? '' : String(item.price),
      originalPrice: item.originalPrice === undefined || item.originalPrice === null ? '' : String(item.originalPrice),
      image: item.image || '',
    }))
    .filter((item) => item.name || item.image);
}

function getProductPrice(product) {
  const variationPrice = Array.isArray(product?.variations)
    ? product.variations.find((variation) => variation?.newPrice || variation?.oldPrice)?.newPrice ||
      product.variations.find((variation) => variation?.newPrice || variation?.oldPrice)?.oldPrice
    : null;
  return product?.price || product?.newPrice || product?.salePrice || variationPrice || product?.advanceAmount || '';
}

function getProductImage(product) {
  if (product?.image || product?.productImage) return product.image || product.productImage;
  if (Array.isArray(product?.images) && product.images[0]) return product.images[0];
  if (typeof product?.images === 'string') {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    } catch {
      return product.images;
    }
  }
  return '';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
