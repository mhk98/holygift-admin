// Helpers for the product variant builder (one row per option combination).

const emptyRow = { purchasePrice: '', oldPrice: '', discountPercent: '', newPrice: '', stock: '', sku: '', image: '', availability: 'in stock' };

export function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
}

export function optionKey(options) {
  return Object.keys(options || {})
    .sort()
    .map(name => `${name.toLowerCase()}=${String(options[name]).toLowerCase()}`)
    .join('|');
}

export function calcDiscountPercent(oldPrice, newPrice) {
  const oldNum = Number(oldPrice);
  const newNum = Number(newPrice);
  if (!oldNum || !newNum || oldNum <= newNum) return '';
  return Number((((oldNum - newNum) / oldNum) * 100).toFixed(2));
}

export function calcDiscountedPrice(oldPrice, discountPercent) {
  const oldNum = Number(oldPrice);
  const discountNum = Number(discountPercent);
  if (!oldNum || Number.isNaN(discountNum)) return '';
  return Math.max(0, Math.round(oldNum - ((oldNum * discountNum) / 100)));
}

function combinations(groups) {
  const active = groups.filter(group => group.name && group.values.length);
  return active.reduce(
    (acc, group) => acc.flatMap(options => group.values.map(value => ({ ...options, [group.name]: value }))),
    [{}],
  );
}

export function buildRows(groups, previousRows) {
  const previous = new Map(previousRows.map(row => [row.key, row]));
  return combinations(groups).map((options) => {
    const key = optionKey(options);
    return { ...emptyRow, ...(previous.get(key) || {}), key, options: Object.keys(options).length ? options : null };
  });
}

export function groupsFromRows(rows) {
  const groups = [];
  rows.forEach(row => Object.entries(row.options || {}).forEach(([name, value]) => {
    let group = groups.find(item => item.name === name);
    if (!group) { group = { name, values: [] }; groups.push(group); }
    if (!group.values.includes(value)) group.values.push(value);
  }));
  return groups;
}

// Product.variations from the API -> editable rows (keeps Id so the variant keeps its identity).
export function variantsFromProduct(variations = []) {
  const rows = [...variations]
    .sort((a, b) => Number(a.Id) - Number(b.Id))
    .map((v) => {
      const options = parseJson(v.options, null) || (v.attribute ? { Option: v.attribute } : null);
      return {
        ...emptyRow,
        Id: v.Id,
        key: optionKey(options),
        options,
        sku: v.sku || '',
        image: v.colorImage || '',
        purchasePrice: v.purchasePrice ?? '',
        oldPrice: v.oldPrice ?? '',
        newPrice: v.newPrice ?? '',
        discountPercent: calcDiscountPercent(v.oldPrice, v.newPrice),
        stock: v.stock ?? '',
        availability: v.availability || 'in stock',
      };
    });
  return rows.length ? rows : [{ ...emptyRow, key: '', options: null }];
}

export function newVariantRows() {
  return [{ ...emptyRow, key: '', options: null }];
}

// Rows without a price are combinations that are not sold, so they are not saved.
export function serializeVariants(rows) {
  return rows
    .filter(row => row.newPrice !== '' && row.newPrice !== null && Number(row.newPrice) > 0)
    .map((row) => {
      const payload = { ...row };
      delete payload.key;
      delete payload.discountPercent;
      return payload;
    });
}

function variationOptions(variation) {
  return parseJson(variation.options, null) || (variation.attribute ? { Option: variation.attribute } : null);
}

export function variantLabel(options) {
  return Object.entries(options || {}).map(([name, value]) => `${name}: ${value}`).join(', ');
}

// POS: one sellable unit per variant, e.g. "Attar (6ml / Gold)", with its own price and stock.
export function sellableUnits(product, images = []) {
  const variations = [...(product.variations || [])].sort((a, b) => Number(a.Id) - Number(b.Id));
  if (!variations.length) {
    return [{ id: `${product.Id}`, productId: product.Id, variantId: null, name: product.name, baseName: product.name, variant: '', price: 0, stock: 0, sku: product.sku || '', images }];
  }
  return variations.map((variation) => {
    const options = variationOptions(variation);
    const values = Object.values(options || {});
    return {
      id: `${product.Id}:${variation.Id}`,
      productId: product.Id,
      variantId: variation.Id,
      name: values.length && variations.length > 1 ? `${product.name} (${values.join(' / ')})` : product.name,
      baseName: product.name,
      variant: variantLabel(options),
      price: Number(variation.newPrice || variation.oldPrice || 0),
      stock: variation.availability === 'out of stock' ? 0 : Number(variation.stock) || 0,
      sku: variation.sku || product.sku || '',
      images: variation.colorImage ? [variation.colorImage, ...images.filter((image) => image !== variation.colorImage)] : images,
    };
  });
}

// Cart line -> order item for the staff order API.
export function toOrderItem(line) {
  return {
    id: line.productId || null,
    variantId: line.variantId || undefined,
    name: line.baseName || line.name,
    image: line.images?.[0] || null,
    price: Number(line.price) || 0,
    qty: Number(line.qty) || 1,
    disc: Number(line.disc) || 0,
  };
}

// Stored order items (order.note meta) -> editable cart lines.
export function cartLinesFromOrder(order) {
  const meta = parseJson(order.note, {}) || {};
  const items = Array.isArray(meta.items) ? meta.items : [];
  if (!items.length) {
    const qty = Number(order.quantity) || 1;
    return {
      lines: [{ id: 'legacy', productId: null, variantId: null, name: order.productName || 'Product', baseName: order.productName || 'Product', price: Math.round((Number(order.totalBill) || 0) / qty), qty, disc: 0, sku: '', images: order.productImage ? [order.productImage] : [] }],
      // The legacy total already includes delivery.
      deliveryCharge: 0,
      discount: 0,
      legacy: true,
    };
  }
  return {
    lines: items.map((item, idx) => ({
      id: item.id ? `${item.id}:${item.variantId || ''}` : `line-${idx}`,
      productId: item.id || null,
      variantId: item.variantId || null,
      name: item.variant ? `${item.name} (${item.variant})` : item.name,
      baseName: item.name,
      price: Number(item.price) || 0,
      qty: Number(item.qty) || 1,
      disc: Number(item.disc) || 0,
      sku: '',
      images: item.image ? [item.image] : [],
    })),
    deliveryCharge: Number(meta.deliveryCharge) || 0,
    discount: Number(meta.discount) || 0,
  };
}

// Variant images reference product images: an existing path, or "new:<i>" for the i-th
// file being uploaded in the same save (the API swaps it for the uploaded path).
export function clearImageRef(rows, ref) {
  return rows.map(row => (row.image === ref ? { ...row, image: '' } : row));
}

export function shiftNewImageRefs(rows, removedIdx) {
  return rows.map((row) => {
    const match = /^new:(\d+)$/.exec(row.image || '');
    if (!match) return row;
    const idx = Number(match[1]);
    if (idx === removedIdx) return { ...row, image: '' };
    return idx > removedIdx ? { ...row, image: `new:${idx - 1}` } : row;
  });
}
