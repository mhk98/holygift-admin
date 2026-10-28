import { useEffect, useState } from 'react';
import Select from 'react-select';
import { productService } from '../services/productService';
import { imageUrl } from '../utils/assetUrl';

const SELECT_STYLES = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    fontSize: 13,
    borderRadius: 6,
    borderColor: state.isFocused ? '#60a5fa' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 1px #93c5fd' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#60a5fa' : '#9ca3af' },
  }),
  menu: (base) => ({ ...base, fontSize: 13 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  multiValue: (base) => ({ ...base, backgroundColor: '#eff6ff', borderRadius: 4 }),
  multiValueLabel: (base) => ({ ...base, color: '#1d4ed8' }),
};

const firstImage = (product) => {
  let images = product.images;
  if (typeof images === 'string') {
    try { images = JSON.parse(images); } catch { images = []; }
  }
  return product.file || (Array.isArray(images) ? images[0] : null) || null;
};

function formatOption(option) {
  return (
    <div className="flex items-center gap-2">
      {option.image && (
        <img src={imageUrl(option.image)} alt="" className="w-5 h-5 rounded object-cover" />
      )}
      <span>{option.label}</span>
    </div>
  );
}

// Multi-select of all products (Active and Inactive) given free with a product;
// `value` is an array of product Ids. `excludeId` hides the product being edited.
export default function GiftProductSelect({ value = [], onChange, excludeId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productService.getAllList()
      .then((r) => setProducts(Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const options = products
    .filter((product) => Number(product.Id) !== Number(excludeId))
    .map((product) => ({
      value: Number(product.Id),
      label: product.status === 'Inactive' ? `${product.name} — Inactive` : product.name,
      image: firstImage(product),
    }));
  const selected = options.filter((option) => value.includes(option.value));

  return (
    <div className="w-full max-w-md">
      <Select
        isMulti
        // Product form cards clip overflow, so the menu renders on <body>.
        menuPortalTarget={document.body}
        menuPosition="fixed"
        isLoading={loading}
        options={options}
        value={selected}
        onChange={(items) => onChange((items || []).map((item) => item.value))}
        formatOptionLabel={formatOption}
        closeMenuOnSelect={false}
        placeholder="Select product..."
        noOptionsMessage={() => 'কোনো product পাওয়া যায়নি'}
        styles={SELECT_STYLES}
      />
    </div>
  );
}
