export const DEFAULT_ORDER_STATUSES = [
  { key: 'pending', label: 'Pending', color: '#3b82f6', className: 'bg-blue-500 text-white' },
  { key: 'packaging', label: 'Packaging', color: '#8b5cf6', className: 'bg-purple-500 text-white' },
  { key: 'confirmed', label: 'Confirmed', color: '#14b8a6', className: 'bg-teal-500 text-white' },
  { key: 'cancelled', label: 'Cancelled', color: '#ef4444', className: 'bg-red-500 text-white' },
  { key: 'returned', label: 'Returned', color: '#f59e0b', className: 'bg-amber-500 text-white' },
  { key: 'on_hold', label: 'On Hold', color: '#6b7280', className: 'bg-gray-400 text-white' },
  { key: 'in_courier', label: 'In Courier', color: '#6366f1', className: 'bg-indigo-500 text-white' },
  { key: 'delivered', label: 'Delivered', color: '#22c55e', className: 'bg-green-500 text-white' },
  { key: 'incomplete', label: 'Incomplete', color: '#f97316', className: 'bg-orange-500 text-white' },
];

const PALETTE = [
  { color: '#3b82f6', className: 'bg-blue-500 text-white' },
  { color: '#14b8a6', className: 'bg-teal-500 text-white' },
  { color: '#8b5cf6', className: 'bg-purple-500 text-white' },
  { color: '#6366f1', className: 'bg-indigo-500 text-white' },
  { color: '#22c55e', className: 'bg-green-500 text-white' },
  { color: '#ef4444', className: 'bg-red-500 text-white' },
  { color: '#f59e0b', className: 'bg-amber-500 text-white' },
  { color: '#f97316', className: 'bg-orange-500 text-white' },
  { color: '#6b7280', className: 'bg-gray-400 text-white' },
];

export function toOrderStatusKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeOrderStatuses(rows) {
  const source = Array.isArray(rows) && rows.length ? [...DEFAULT_ORDER_STATUSES, ...rows] : DEFAULT_ORDER_STATUSES;
  const fallbackByKey = Object.fromEntries(DEFAULT_ORDER_STATUSES.map((s) => [s.key, s]));
  const seen = new Set();

  return source
    .map((row, index) => {
      const label = row.label || row.name || row.key || '';
      const key = toOrderStatusKey(row.key || label);
      const fallback = fallbackByKey[key] || {};
      const tone = PALETTE[index % PALETTE.length];
      return {
        ...row,
        key,
        label,
        color: row.color || fallback.color || tone.color,
        className: row.className || fallback.className || tone.className,
      };
    })
    .filter((row) => row.key && row.label && !seen.has(row.key) && seen.add(row.key));
}

export function buildStatusMaps(statuses) {
  const normalized = normalizeOrderStatuses(statuses);
  return {
    statuses: normalized,
    labels: {
      all: 'All Orders',
      ...Object.fromEntries(normalized.map((s) => [s.key, s.label])),
    },
    classes: Object.fromEntries(normalized.map((s) => [s.key, s.className])),
  };
}
