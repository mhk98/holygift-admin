// Accept JSON strings from older API responses as well as native arrays.
export function normalizeCrossProducts(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value.filter((product) => product && Number.isSafeInteger(Number(product.Id))
    && Number(product.Id) > 0 && typeof product.name === 'string')
    .map((product) => ({
      Id: Number(product.Id), name: product.name,
      priceMin: product.priceMin != null && Number.isFinite(Number(product.priceMin)) ? Number(product.priceMin) : null,
      priceMax: product.priceMax != null && Number.isFinite(Number(product.priceMax)) ? Number(product.priceMax) : null,
    }));
}

export function crossProductStickerText(value) {
  return normalizeCrossProducts(value).map((product) => {
    const min = product.priceMin;
    const max = product.priceMax ?? min;
    const money = (amount) => `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;
    const price = min == null ? 'Price unavailable' : max > min ? `${money(min)}–${money(max)}` : money(min);
    return `${product.name} (${price})`;
  }).join(', ');
}

export function crossProductCollectionTotal(card) {
  let total = Number(card.deliveryCharge ?? card.codAmount ?? 0);
  for (const product of normalizeCrossProducts(card.crossProducts)) {
    if (product.priceMin == null || product.priceMin !== product.priceMax) return null;
    total += product.priceMin;
  }
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : null;
}
