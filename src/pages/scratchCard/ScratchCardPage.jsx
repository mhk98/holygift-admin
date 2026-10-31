import { useState, useEffect, useCallback, useMemo } from 'react';
import Select from 'react-select';
import { normalizeCrossProducts } from '../../utils/crossProducts';
import { X, Trash2, StickyNote, Pencil, Check, Filter, RotateCcw, Search, ChevronLeft, ChevronRight, Printer, Plus, Unlink } from 'lucide-react';
import { productService } from '../../services/productService';
import { scratchCardService, scratchCardPrizeService } from '../../services/scratchCardService';
import { imageUrl } from '../../utils/assetUrl';
import { useAuth } from '../../context/AuthContext';
import ScratchCardStickerSheet from './ScratchCardStickerSheet';

// Statuses set by hand; must match SCRATCH_CARD_STATUSES in the backend. Once a
// card is sent to Steadfast/Pathao its status is the courier's own.
const STATUSES = ['Pending', 'Approved', 'Rejected', 'Not Responding'];

const STATUS_STYLES = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-blue-50 text-blue-700 border-blue-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
  'Not Responding': 'bg-gray-100 text-gray-700 border-gray-300',
  Delivered: 'bg-green-50 text-green-700 border-green-200',
};
const COURIERS_FOR_FILTER = ['Pathao', 'Steadfast'];

// The prizes on the storefront form, managed under Scratch Card > Prizes.
// Loaded once per session; the filter and prize editor share the request.
let prizeOptionsRequest = null;
function usePrizeOptions() {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    prizeOptionsRequest ||= scratchCardPrizeService.getPublic()
      .then((res) => (res.data || []).map((p) => ({ value: p.name, label: p.nameBn ? `${p.name} (${p.nameBn})` : p.name })))
      .catch(() => { prizeOptionsRequest = null; return []; });
    let alive = true;
    prizeOptionsRequest.then((opts) => { if (alive) setOptions(opts); });
    return () => { alive = false; };
  }, []);
  return options;
}

// Courier status filter values, matching courierStatusCondition in the backend.
// Each courier has its own field, so every value is scoped to that courier.
const NOT_SENT = '__not_sent';
const COURIER_STAGES = [
  { stage: 'in_courier', label: 'In Courier' },
  { stage: 'on_hold', label: 'On Hold' },
  { stage: 'delivered', label: 'Delivered' },
  { stage: 'returned', label: 'Returned' },
  { stage: 'cancelled', label: 'Cancelled' },
];
const courierFilterOptions = (courier, statuses = []) => [
  { label: 'Courier', options: [{ value: `courier:${courier}`, label: `All sent to ${courier}` }] },
  { label: 'Stage', options: COURIER_STAGES.map(({ stage, label }) => ({ value: `courierStage:${courier}:${stage}`, label })) },
  ...(statuses.length
    ? [{ label: `${courier} Status`, options: statuses.map((st) => ({ value: `courierStatus:${courier}:${st}`, label: st })) }]
    : []),
];

// react-select sized to match the other h-9 filter inputs.
const FILTER_SELECT_STYLES = {
  control: (base, state) => ({
    ...base,
    minHeight: 36,
    height: 36,
    fontSize: 12,
    borderRadius: 6,
    borderColor: state.isFocused ? '#818cf8' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 1px #c7d2fe' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#818cf8' : '#9ca3af' },
  }),
  valueContainer: (base) => ({ ...base, padding: '0 8px' }),
  indicatorsContainer: (base) => ({ ...base, height: 34 }),
  dropdownIndicator: (base) => ({ ...base, padding: 6 }),
  clearIndicator: (base) => ({ ...base, padding: 6 }),
  menu: (base) => ({ ...base, fontSize: 12, zIndex: 30 }),
};

const COURIER_STATUS_STYLE = 'bg-violet-50 text-violet-700 border-violet-200';

// Filter rows: auto-fit fills the width and wraps on narrow screens.
const DELIVERY_AREA_OPTIONS = [
  { value: 'inside', label: 'ঢাকার ভিতরে' },
  { value: 'outside', label: 'ঢাকার বাইরে' },
];
// Shown above the product list in the Cross Product filter.
const CROSS_PRODUCT_PRESENCE_OPTIONS = [
  { value: 'any', label: 'With cross products' },
  { value: 'none', label: 'Without cross products' },
];

const FILTER_ROW_FIELDS = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: '12px 16px',
};
const FILTER_ROW_DATES = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '12px 24px',
};

// chunk: cards per request. Steadfast books them in one bulk call (max 500);
// Pathao books one by one, so smaller chunks keep each request short.
const COURIERS = [
  { key: 'steadfast', label: 'Steadfast', chunk: 500 },
  { key: 'pathao', label: 'Pathao', chunk: 100 },
];

// One line per card the courier didn't take, so the admin knows what to fix.
// Pathao rejects shorter delivery addresses.
const MIN_PATHAO_ADDRESS_LENGTH = 10;
const isShortAddress = (address) => String(address || '').trim().length < MIN_PATHAO_ADDRESS_LENGTH;

function courierSummary(title, done, problems, problemTitle = 'পাঠানো যায়নি:') {
  const lines = [`${title}: ${done}`];
  if (problems.length) {
    lines.push('', problemTitle);
    // Same reason once, with every card it applies to, so other reasons stand out.
    const byMessage = new Map();
    problems.forEach((p) => byMessage.set(p.message, [...(byMessage.get(p.message) || []), p.reference]));
    [...byMessage].sort((a, b) => b[1].length - a[1].length).forEach(([message, refs]) => {
      lines.push('', `• ${message} (${refs.length} টি):`, refs.join(', '));
    });
  }
  return lines.join('\n');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// claimType "first" = a phone's first claim; "repeat" = a further card from a
// phone that already claimed, which management verifies before approving.
const PAGE_COPY = {
  first: {
    title: 'Scratch Card',
    subtitle: 'Prize claims submitted from the storefront scratch card form.',
    empty: 'No scratch card claims found',
  },
  repeat: {
    title: 'Repeat Scratch Card',
    subtitle: 'Further cards submitted from a phone number that already claimed a prize. Check the previous claims before approving.',
    empty: 'No repeat scratch card claims found',
  },
};

export default function ScratchCardPage({ claimType = 'first' }) {
  const prizeOptions = usePrizeOptions();
  const isRepeat = claimType === 'repeat';
  const copy = PAGE_COPY[claimType] || PAGE_COPY.first;
  const { user } = useAuth();
  // Admins assign claims to agents. An agent sees every claim, their own
  // first, but can only change their own (the backend enforces this).
  const userRole = String(user?.role || '').trim().toLowerCase();
  const canAssign = ['superadmin', 'admin'].includes(userRole);
  // Leaders see and work every claim like an admin, but cannot assign or delete.
  const canViewAll = canAssign || userRole === 'leader';
  const canEditRow = (row) => canViewAll || Number(row.assignedAgentId) === Number(user?.Id);
  const [productOptions, setProductOptions] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [productReload, setProductReload] = useState(0);
  const [agents, setAgents]     = useState([]);
  const [agentsError, setAgentsError] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [courierBusy, setCourierBusy] = useState(false);
  const [stickerCards, setStickerCards] = useState([]);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [reference, setReference] = useState('');
  const [phone, setPhone]       = useState('');
  const [status, setStatus]     = useState('');
  const [crossProductId, setCrossProductId] = useState('');
  const [prize, setPrize]       = useState('');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [courierStatus, setCourierStatus] = useState({ Pathao: [], Steadfast: [] });
  const [submittedFrom, setSubmittedFrom] = useState('');
  const [submittedTo, setSubmittedTo]     = useState('');
  const [approvedFrom, setApprovedFrom]   = useState('');
  const [approvedTo, setApprovedTo]       = useState('');
  const [page, setPage]         = useState(1);
  const [meta, setMeta]         = useState({});
  const [preview, setPreview]   = useState(null);
  const [noteTarget, setNoteTarget] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [limit, setLimit]       = useState(10);
  const [creating, setCreating] = useState(false);

  // A card has one courier, so picks from both courier fields widen the list (OR).
  const selectedCourierFilters = useMemo(() => [
    ...(status === NOT_SENT ? ['none'] : []),
    ...COURIERS_FOR_FILTER.flatMap((c) => courierStatus[c]),
  ], [status, courierStatus]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await scratchCardService.getAll({
        searchTerm: search || undefined,
        reference: reference.trim() || undefined,
        phone: phone.trim() || undefined,
        status: status === NOT_SENT ? undefined : status || undefined,
        prize: prize || undefined,
        crossProductId: crossProductId || undefined,
        deliveryArea: deliveryArea || undefined,
        courierStatus: selectedCourierFilters.length ? JSON.stringify(selectedCourierFilters) : undefined,
        submittedFrom: submittedFrom || undefined,
        submittedTo: submittedTo || undefined,
        approvedFrom: approvedFrom || undefined,
        approvedTo: approvedTo || undefined,
        assignedAgentId: agentFilter || undefined,
        claimType,
        page,
        limit,
      });
      setRows(res.data || []);
      setMeta(res.meta || {});
      setSelectedIds([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, reference, phone, status, prize, crossProductId, deliveryArea, selectedCourierFilters, submittedFrom, submittedTo, approvedFrom, approvedTo, agentFilter, claimType, page, limit]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    if (!canViewAll) return;
    scratchCardService.getAgents()
      .then((res) => { setAgents(res.data || []); setAgentsError(''); })
      .catch((err) => { setAgents([]); setAgentsError(err.message || 'Agent list load failed'); });
  }, [canViewAll]);

  useEffect(() => {
    let cancelled = false;
    productService.getAllList()
      .then((res) => {
        if (!cancelled) setProductOptions((res.data || []).map((p) => ({
          value: Number(p.Id), label: p.sku ? `${p.name} (${p.sku})` : p.name,
        })));
      })
      .catch((err) => { if (!cancelled) setProductsError(err.message || 'Products could not be loaded'); })
      .finally(() => { if (!cancelled) setProductsLoading(false); });
    return () => { cancelled = true; };
  }, [productReload]);

  async function handleAssign() {
    if (!selectedIds.length) return alert('Assign করার জন্য আগে scratch card select করুন');
    if (!assignAgentId) return alert('Assign To থেকে agent select করুন');
    const agentId = assignAgentId === 'none' ? null : Number(assignAgentId);
    const agentName = agents.find((a) => a.Id === agentId)?.name;
    const question = agentId
      ? `${selectedIds.length} টি scratch card ${agentName} কে assign করবেন?`
      : `${selectedIds.length} টি scratch card থেকে assignment সরাবেন?`;
    if (!window.confirm(question)) return;
    setAssigning(true);
    try {
      await scratchCardService.assign(selectedIds, agentId);
      setAssignAgentId('');
      fetchRows();
    } catch (err) {
      alert(err.message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleSendToCourier(provider) {
    if (!selectedIds.length) return alert('Courier এ পাঠানোর জন্য আগে Approved scratch card select করুন');
    if (!window.confirm(`${selectedIds.length} টি scratch card ${provider.label} এ পাঠাবেন?`)) return;
    setCourierBusy(true);
    // One request per chunk keeps each courier call short enough to finish;
    // a failed chunk stops the rest so nothing is sent twice by mistake.
    const sent = [];
    const skipped = [];
    let failure = null;
    for (let start = 0; start < selectedIds.length; start += provider.chunk) {
      const chunk = selectedIds.slice(start, start + provider.chunk);
      try {
        const res = await scratchCardService.sendToCourier(provider.key, chunk);
        sent.push(...(res.data?.sent || []));
        skipped.push(...(res.data?.skipped || []));
      } catch (err) {
        failure = `${start + 1}–${start + chunk.length} নম্বর card পাঠানোর সময় সমস্যা: ${err.message}\n` +
          `বাকি ${selectedIds.length - start} টি card পাঠানো হয়নি। আবার পাঠানোর আগে ${provider.label} panel এ check করুন।`;
        break;
      }
    }
    const summary = courierSummary(`${provider.label} এ পাঠানো হয়েছে`, sent.length, skipped);
    alert(failure ? `${failure}\n\n${summary}` : summary);
    fetchRows();
    setCourierBusy(false);
  }

  async function handleSyncCourier() {
    if (!selectedIds.length) return alert('Status sync করার জন্য courier এ পাঠানো scratch card select করুন');
    setCourierBusy(true);
    try {
      const res = await scratchCardService.syncCourier(selectedIds);
      const { synced = [], failed = [] } = res.data || {};
      alert(courierSummary('Status sync হয়েছে', synced.length, failed));
      fetchRows();
    } catch (err) {
      alert(err.message);
    } finally {
      setCourierBusy(false);
    }
  }

  // Unlinking only clears our record; the parcel stays booked at the courier.
  async function handleUnlinkCourier(ids) {
    const cards = rows.filter((row) => ids.includes(row.Id));
    const linked = cards.filter((row) => row.courier);
    if (!linked.length) return alert('Select করা কোনো card courier এ পাঠানো হয়নি।');
    const list = linked.slice(0, 10).map((row) => `• ${row.referenceCode} — ${row.courier}${row.consignmentId ? ` (${row.consignmentId})` : ''}`).join('\n');
    const more = linked.length > 10 ? `\n...আরো ${linked.length - 10} টি` : '';
    if (!window.confirm(
      `${linked.length} টি card এর courier unlink করবেন?\n\n${list}${more}\n\n` +
      'Consignment ID ও tracking মুছে card আবার Approved হবে, তারপর সঠিক courier এ পাঠাতে পারবেন।\n' +
      'Courier এর কাছে parcel টি থেকে যাবে — Steadfast/Pathao panel থেকে সেটি cancel করুন। পুরনো consignment ID note এ রাখা থাকবে।'
    )) return;
    setCourierBusy(true);
    try {
      const res = await scratchCardService.unlinkCourier(linked.map((row) => row.Id));
      const { unlinked = [], skipped = [] } = res.data || {};
      alert(courierSummary('Courier unlink হয়েছে', unlinked.length, skipped, 'Unlink করা যায়নি:'));
      fetchRows();
    } catch (err) {
      alert(err.message);
    } finally {
      setCourierBusy(false);
    }
  }

  // Print once the sticker sheet has rendered, and drop it afterwards.
  useEffect(() => {
    if (!stickerCards.length) return undefined;
    const handleAfterPrint = () => setStickerCards([]);
    window.addEventListener('afterprint', handleAfterPrint);
    const timer = window.setTimeout(() => window.print(), 100);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [stickerCards]);

  function handlePrintStickers() {
    const selected = rows.filter((row) => selectedIds.includes(row.Id));
    if (!selected.length) return alert('Sticker print করার জন্য আগে scratch card select করুন');
    const printable = selected.filter((row) => ['Pathao', 'Steadfast'].includes(row.courier) && (row.consignmentId || row.trackingCode));
    if (!printable.length) return alert('Select করা কোনো card courier এ পাঠানো হয়নি। আগে Send to Steadfast বা Send to Pathao করুন।');
    const skipped = selected.length - printable.length;
    if (skipped && !window.confirm(`${skipped} টি card courier এ পাঠানো হয়নি, সেগুলো বাদ যাবে। বাকি ${printable.length} টি sticker print করবেন?`)) return;
    setStickerCards(printable);
  }

  function toggleSelected(id) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function updateRow(row, data) {
    setSavingId(row.Id);
    try {
      const res = await scratchCardService.update(row.Id, data);
      setRows((prev) => prev.map((r) => (r.Id === row.Id ? { ...r, ...(res.data || data) } : r)));
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveNote(e) {
    e.preventDefault();
    if (await updateRow(noteTarget, { note: noteTarget.note || '' })) setNoteTarget(null);
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete scratch card claim from ${row.fullName}?`)) return;
    try {
      await scratchCardService.delete(row.Id);
      fetchRows();
    } catch (err) {
      alert(err.message);
    }
  }

  const totalCount = meta?.count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const pageItems = paginationItems(page, totalPages);
  const columns = [
    'SL', 'Reference', 'Consignment ID', 'Date', 'Card Image', 'Full Name', 'Phone', 'Delivered Address', 'Prize', 'Cross Product', 'Delivery Charge',
    ...(isRepeat ? ['Previous Claims'] : []),
    ...(canViewAll ? ['Assigned To'] : []),
    'Status', 'Action',
  ];
  const colCount = columns.length + (canViewAll ? 1 : 0);
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.Id));
  const filterClass = 'w-full h-9 text-xs border border-gray-300 rounded-md px-2.5 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200';
  const filterValues = [search, reference, phone, status, prize, crossProductId, deliveryArea, ...COURIERS_FOR_FILTER.map((c) => courierStatus[c]), agentFilter, submittedFrom, submittedTo, approvedFrom, approvedTo];
  const activeFilterCount = filterValues.filter((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)).length;

  const statusOptions = [
    { value: NOT_SENT, label: 'Not sent to courier' },
    ...(meta?.statuses?.length ? meta.statuses : STATUSES).map((st) => ({ value: st, label: st })),
  ];

  const agentOptions = [
    { value: 'unassigned', label: 'Not Assigned' },
    ...agents.map((a) => ({ value: String(a.Id), label: `${a.name}${a.role ? ` (${a.role})` : ''}` })),
  ];
  const assignAgentOptions = [
    ...agentOptions.slice(1),
    { value: 'none', label: '— Remove assignment —' },
  ];

  function resetFilters() {
    setCourierStatus({ Pathao: [], Steadfast: [] });
    [setSearch, setReference, setPhone, setStatus, setPrize, setCrossProductId, setDeliveryArea, setAgentFilter,
      setSubmittedFrom, setSubmittedTo, setApprovedFrom, setApprovedTo].forEach((set) => set(''));
    setPage(1);
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-800">{copy.title}</h1>
          <p className="mt-1 text-xs text-gray-500">{copy.subtitle}</p>
        </div>
        <button type="button" onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition">
          <Plus size={14} /> Create Scratch Card
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
              <Filter size={13} /> Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-indigo-100 text-indigo-700 px-1.5 py-0.5 text-[10px] normal-case">{activeFilterCount} active</span>
              )}
            </h2>
            <button type="button" onClick={resetFilters} disabled={!activeFilterCount}
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <RotateCcw size={12} /> Reset
            </button>
          </div>

          {/* Plain CSS grid (auto-fit) so the layout adapts to any width without
              depending on breakpoint classes: row 1 = the five single fields,
              row 2 = the two date ranges side by side. */}
          <div style={FILTER_ROW_FIELDS}>
            <FilterField label="Search">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Name, phone, prize or ref" className={filterClass} style={{ paddingLeft: '2rem' }} />
              </div>
            </FilterField>
            {/* Reference finds one claim; phone finds every claim from that number on this page (first or repeat). */}
            <FilterField label="Reference">
              <input value={reference} onChange={(e) => { setReference(e.target.value); setPage(1); }}
                placeholder="SC-7K4Q9P" className={`${filterClass} font-mono uppercase`} />
            </FilterField>
            <FilterField label="Phone">
              <input value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 11)); setPage(1); }}
                placeholder="01XXXXXXXXX" inputMode="numeric" className={`${filterClass} font-mono`} />
            </FilterField>
            <FilterField label="Status">
              <Select
                options={statusOptions}
                value={statusOptions.find((option) => option.value === status) || (status ? { value: status, label: status } : null)}
                onChange={(opt) => { setStatus(opt?.value || ''); setPage(1); }}
                placeholder="All Status"
                isClearable
                styles={FILTER_SELECT_STYLES}
              />
            </FilterField>
            {COURIERS_FOR_FILTER.map((c) => {
              const options = courierFilterOptions(c, meta?.courierStatusesByCourier?.[c]);
              return (
                <FilterField key={c} label={`${c} Status`}>
                  <Select
                    options={options}
                    value={courierStatus[c].map((value) => options.flatMap((g) => g.options).find((o) => o.value === value)
                      || { value, label: value.split(':').slice(2).join(':') })}
                    onChange={(picked) => { setCourierStatus((prev) => ({ ...prev, [c]: (picked || []).map((o) => o.value) })); setPage(1); }}
                    isMulti
                    closeMenuOnSelect={false}
                    aria-label={`${c} Status filter`}
                    placeholder={`All ${c} Statuses`}
                    isClearable
                    styles={{ ...FILTER_SELECT_STYLES,
                      control: (base, state) => ({ ...FILTER_SELECT_STYLES.control(base, state), height: 'auto' }),
                    }}
                  />
                </FilterField>
              );
            })}
            <FilterField label="Prize">
              <Select
                options={prizeOptions}
                value={prize ? { value: prize, label: prize } : null}
                onChange={(opt) => { setPrize(opt?.value || ''); setPage(1); }}
                placeholder="All Prizes"
                isClearable
                styles={FILTER_SELECT_STYLES}
              />
            </FilterField>
            <FilterField label="Cross Product">
              <Select
                options={[...CROSS_PRODUCT_PRESENCE_OPTIONS, ...productOptions]}
                value={[...CROSS_PRODUCT_PRESENCE_OPTIONS, ...productOptions].find((option) => String(option.value) === crossProductId) || null}
                onChange={(option) => { setCrossProductId(option ? String(option.value) : ''); setPage(1); }}
                placeholder="All Cross Products"
                aria-label="Filter by Cross Product"
                isClearable
                isLoading={productsLoading}
                isDisabled={productsLoading || Boolean(productsError)}
                styles={FILTER_SELECT_STYLES}
              />
            </FilterField>
            <FilterField label="Delivery Area">
              <Select
                options={DELIVERY_AREA_OPTIONS}
                value={DELIVERY_AREA_OPTIONS.find((option) => option.value === deliveryArea) || null}
                onChange={(option) => { setDeliveryArea(option?.value || ''); setPage(1); }}
                placeholder="All Areas"
                aria-label="Filter by Delivery Area"
                isClearable
                styles={FILTER_SELECT_STYLES}
              />
            </FilterField>
            {canViewAll && (
              <FilterField label="Agent">
                <Select
                  options={agentOptions}
                  value={agentOptions.find((o) => o.value === agentFilter) || null}
                  onChange={(opt) => { setAgentFilter(opt?.value || ''); setPage(1); }}
                  placeholder="All Agents"
                  isClearable
                  styles={FILTER_SELECT_STYLES}
                />
              </FilterField>
            )}
          </div>

          <div style={FILTER_ROW_DATES}>
            <DateRange label="Submitted Date" from={submittedFrom} to={submittedTo} className={filterClass}
              onFrom={(v) => { setSubmittedFrom(v); setPage(1); }} onTo={(v) => { setSubmittedTo(v); setPage(1); }} />
            <DateRange label="Approved Date" from={approvedFrom} to={approvedTo} className={filterClass}
              onFrom={(v) => { setApprovedFrom(v); setPage(1); }} onTo={(v) => { setApprovedTo(v); setPage(1); }} />
          </div>
        </div>

        {canViewAll && (
          <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60">
            <span className="text-xs text-gray-600">{selectedIds.length} selected{canAssign && ' · Assign To:'}</span>
            {canAssign && (<>
            <div className="w-56">
              <Select
                options={assignAgentOptions}
                value={assignAgentOptions.find((o) => o.value === assignAgentId) || null}
                onChange={(opt) => setAssignAgentId(opt?.value || '')}
                placeholder="Select Agent"
                isClearable
                styles={FILTER_SELECT_STYLES}
              />
            </div>
            <button type="button" onClick={handleAssign} disabled={assigning || !selectedIds.length}
              className="rounded-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-1.5 transition">
              {assigning ? 'Assigning...' : 'Assign Selected'}
            </button>
            {agentsError ? (
              <span className="text-[11px] text-red-500">Agent list load হয়নি: {agentsError}</span>
            ) : !agents.length && (
              <span className="text-[11px] text-gray-400">No active staff user (non-admin) yet</span>
            )}
            </>)}
            {/* Approved cards go to the courier; from then on the courier sets the status. */}
            <span className="ml-auto text-xs text-gray-600">Courier:</span>
            {COURIERS.map((provider) => (
              <button key={provider.key} type="button" onClick={() => handleSendToCourier(provider)}
                disabled={courierBusy || !selectedIds.length}
                className="rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-1.5 transition">
                Send to {provider.label}
              </button>
            ))}
            <button type="button" onClick={handleSyncCourier} disabled={courierBusy || !selectedIds.length}
              className="rounded-full border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold px-4 py-1.5 transition">
              {courierBusy ? 'Please wait...' : 'Sync Status'}
            </button>
            <button type="button" onClick={() => handleUnlinkCourier(selectedIds)} disabled={courierBusy || !selectedIds.length}
              title="ভুল courier এ পাঠানো card এর consignment unlink করে আবার পাঠানোর সুযোগ দিন"
              className="flex items-center gap-1 rounded-full border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold px-4 py-1.5 transition">
              <Unlink size={13} /> Unlink Courier
            </button>
            <button type="button" onClick={handlePrintStickers} disabled={!selectedIds.length}
              className="flex items-center gap-1 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold px-4 py-1.5 transition">
              <Printer size={13} /> Print Sticker
            </button>
          </div>
        )}

        <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 text-sm text-gray-500">
          <PageSizePicker value={limit} onChange={(n) => { setLimit(n); setPage(1); }} />
          <span>Total <b className="text-gray-800">{totalCount}</b> entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {canViewAll && (
                  <th className="pl-4 py-3 w-6">
                    <input type="checkbox" checked={allSelected} title="Select all on this page"
                      onChange={() => setSelectedIds(allSelected ? [] : rows.map((row) => row.Id))} />
                  </th>
                )}
                {columns.map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-gray-500 font-semibold select-none">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={colCount} className="text-center py-10 text-gray-400">Loading...</td></tr>}
              {!loading && error && <tr><td colSpan={colCount} className="text-center py-10 text-red-400">{error}</td></tr>}
              {!loading && !error && rows.length === 0 && (
                <tr><td colSpan={colCount} className="text-center py-10 text-gray-400">{copy.empty}</td></tr>
              )}
              {!loading && !error && rows.map((row, i) => {
                const editable = canEditRow(row);
                return (
                <tr key={row.Id} className={`border-b border-gray-50 transition align-top ${
                  !canViewAll && editable ? 'bg-teal-50/60 hover:bg-teal-50' : 'hover:bg-gray-50/60'}`}>
                  {canViewAll && (
                    <td className="pl-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(row.Id)} onChange={() => toggleSelected(row.Id)} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-500">{(page - 1) * limit + i + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-mono font-semibold text-gray-800">{row.referenceCode || '—'}</div>
                    {!canViewAll && (editable ? (
                      <div className="mt-1 inline-block rounded-full bg-teal-100 text-teal-700 px-2 py-0.5 text-[10px] font-semibold">Assigned to you</div>
                    ) : (
                      <div className="mt-1 text-[11px] text-gray-400">View only</div>
                    ))}
                    {(reference || phone) && (
                      <div className="mt-1 text-[11px] text-gray-500">{row.claimType === 'repeat' ? 'Repeat card' : 'First card'}</div>
                    )}
                  </td>
                  {/* Set once the card is sent to Pathao/Steadfast; Steadfast also gives a separate tracking code. */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.courier ? (
                      <>
                        <div className="font-mono font-semibold text-gray-800">{row.consignmentId || '—'}</div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          {row.courier}
                          {row.trackingCode && row.trackingCode !== row.consignmentId && (
                            <> · Tracking <span className="font-mono">{row.trackingCode}</span></>
                          )}
                        </div>
                        {canViewAll && (
                          <button type="button" onClick={() => handleUnlinkCourier([row.Id])} disabled={courierBusy}
                            title={`${row.courier} থেকে unlink করুন`}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 hover:underline disabled:opacity-50">
                            <Unlink size={11} /> Unlink
                          </button>
                        )}
                      </>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    {row.image ? (
                      <button type="button" onClick={() => setPreview(row)} title="View image"
                        className="block w-14 h-14 rounded border border-gray-200 overflow-hidden bg-gray-50 hover:ring-2 hover:ring-blue-300 transition">
                        <img src={imageUrl(row.image)} alt="Scratch card" className="w-full h-full object-cover" />
                      </button>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{row.fullName}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">
                    <a href={`tel:${row.phone}`} className="hover:text-blue-600">{row.phone}</a>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[260px] whitespace-pre-line break-words">
                    {!row.courier && editable ? (
                      <AddressEditor row={row} saving={savingId === row.Id}
                        onSave={(address) => updateRow(row, { address })} />
                    ) : row.address}
                  </td>
                  <td className="px-4 py-3">
                    {editable ? (
                      <PrizeEditor row={row} saving={savingId === row.Id}
                        onSave={(prize) => updateRow(row, { prize })} />
                    ) : <PrizeBadge prize={row.prize} />}
                  </td>
                  <td className="px-4 py-3">
                    {editable ? (
                      <CrossProductEditor row={row} options={productOptions}
                        loading={productsLoading} error={productsError}
                        onRetry={() => { setProductsLoading(true); setProductsError(''); setProductReload((value) => value + 1); }}
                        onSave={(crossProductIds) => updateRow(row, { crossProductIds })} />
                    ) : (
                      <span className="text-gray-600">
                        {normalizeCrossProducts(row.crossProducts).map((product) => product.name).join(', ') || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DeliveryCharge row={row} charges={meta?.deliveryCharges}
                      editable={!row.courier && editable} saving={savingId === row.Id}
                      onChange={(deliveryArea) => updateRow(row, { deliveryArea })}
                      onSaveAmount={(deliveryCharge) => updateRow(row, { deliveryCharge })} />
                  </td>
                  {isRepeat && (
                    <td className="px-4 py-3">
                      <PreviousClaims claims={row.previousClaims} />
                    </td>
                  )}
                  {canViewAll && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.assignedAgentName ? (
                        <>
                          <div className="font-semibold text-gray-700">{row.assignedAgentName}</div>
                          {row.assignedAt && <div className="mt-0.5 text-[11px] text-gray-500">{formatDate(row.assignedAt)}</div>}
                        </>
                      ) : <span className="text-gray-400">Not assigned</span>}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {row.courier || !editable ? (
                      <>
                        <span className={`inline-block rounded-full border px-2.5 py-1 font-semibold whitespace-nowrap ${STATUS_STYLES[row.status] || COURIER_STATUS_STYLE}`}>
                          {row.status}
                        </span>
                        {row.courier && (
                          <p className="mt-1.5 text-[11px] text-gray-500 whitespace-nowrap">
                            {row.courier}
                          </p>
                        )}
                      </>
                    ) : (
                      <select value={row.status} disabled={savingId === row.Id}
                        onChange={(e) => updateRow(row, { status: e.target.value })}
                        className={`rounded-full border px-2 py-1 font-semibold focus:outline-none disabled:opacity-50 ${STATUS_STYLES[row.status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                        {/* Older cards may hold a status no longer offered; keep it visible. */}
                        {!STATUSES.includes(row.status) && <option value={row.status} disabled>{row.status}</option>}
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                    {row.approvedAt && (
                      <p className="mt-1.5 text-[11px] text-gray-500 whitespace-nowrap">Approved: {formatDate(row.approvedAt)}</p>
                    )}
                    {row.note &&<p className="mt-1.5 text-[11px] text-gray-500 max-w-[180px] break-words">{row.note}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {editable && (
                        <button type="button" title="Note" onClick={() => setNoteTarget({ ...row })}
                          className="w-7 h-7 rounded bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center transition">
                          <StickyNote size={12} />
                        </button>
                      )}
                      {canAssign && (
                        <button type="button" title="Delete" onClick={() => handleDelete(row)}
                          className="w-7 h-7 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 flex flex-col items-center gap-2 border-t border-gray-100">
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1">
            <PagBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} label="Previous">
              <ChevronLeft size={16} /><span className="hidden sm:inline">Previous</span>
            </PagBtn>
            {pageItems.map((n) => (
              <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === page ? 'page' : undefined}
                className={`min-w-9 h-9 px-2 rounded-md text-sm font-medium flex items-center justify-center transition ${
                  n === page ? 'bg-indigo-600 text-white shadow-sm' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'}`}>
                {n}
              </button>
            ))}
            <PagBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} label="Next">
              <span className="hidden sm:inline">Next</span><ChevronRight size={16} />
            </PagBtn>
          </nav>
          <span className="text-sm text-gray-500">
            {totalCount ? (
              <>Showing <b className="text-gray-800">{(page - 1) * limit + 1}</b>–<b className="text-gray-800">{Math.min(page * limit, totalCount)}</b> of <b className="text-gray-800">{totalCount}</b> entries</>
            ) : 'No entries'}
          </span>
        </div>
      </div>

      {/* Image preview */}
      {stickerCards.length > 0 && <ScratchCardStickerSheet cards={stickerCards} />}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-800">{preview.referenceCode} · {preview.fullName} · {preview.phone}</h2>
                <p className="text-xs text-gray-500">Claimed prize: {preview.prize}</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 bg-gray-50">
              <img src={imageUrl(preview.image)} alt="Scratch card" className="max-h-[70vh] w-full object-contain rounded" />
            </div>
            <div className="px-5 py-3 text-right">
              <a href={imageUrl(preview.image)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:underline">
                Open full size ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Note modal */}
      {creating && (
        <CreateScratchCardModal
          prizeOptions={prizeOptions}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); setPage(1); fetchRows(); }}
        />
      )}

      {noteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Note · {noteTarget.fullName}</h2>
              <button type="button" onClick={() => setNoteTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveNote} className="px-5 py-4 space-y-4">
              <textarea value={noteTarget.note || ''} rows={4} autoFocus
                onChange={(e) => setNoteTarget((p) => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Verified card, prize sent with courier on 15 Oct"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              <button type="submit" disabled={savingId === noteTarget.Id}
                className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition">
                {savingId === noteTarget.Id ? 'Saving...' : 'Save Note'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const CREATE_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400';

// Staff enter a claim by hand; the backend files it as first or repeat by phone.
function CreateScratchCardModal({ prizeOptions, onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', phone: '', address: '', prize: '', note: '' });
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setError(''); };

  async function handleSubmit(e) {
    e.preventDefault();
    const values = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
    if (!values.fullName || !values.phone || !values.address || !values.prize) {
      setError('Name, phone, address আর prize দিতে হবে'); return;
    }
    if (!/^01\d{9}$/.test(values.phone)) { setError('Phone 01 দিয়ে শুরু ১১ সংখ্যার হতে হবে'); return; }
    if (values.address.length < MIN_PATHAO_ADDRESS_LENGTH) {
      setError(`পুরো ঠিকানা লিখুন — কমপক্ষে ${MIN_PATHAO_ADDRESS_LENGTH} অক্ষর`); return;
    }
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => { if (v) fd.append(k, v); });
    if (image) fd.append('image', image);
    setSaving(true);
    try {
      await scratchCardService.create(fd);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Create Scratch Card</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</span>
              <input value={form.fullName} onChange={set('fullName')} autoFocus className={CREATE_INPUT} />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-600 mb-1">Phone *</span>
              <input value={form.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" inputMode="numeric" maxLength={11} className={CREATE_INPUT} />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Delivery Address *</span>
            <textarea value={form.address} onChange={set('address')} rows={2} placeholder="গ্রাম/এলাকা, থানা, জেলা"
              className={`${CREATE_INPUT} resize-none`} />
          </label>
          <div>
            <span className="block text-xs font-semibold text-gray-600 mb-1">Prize *</span>
            <Select
              options={prizeOptions}
              value={prizeOptions.find((o) => o.value === form.prize) || null}
              onChange={(o) => { setForm((f) => ({ ...f, prize: o?.value || '' })); setError(''); }}
              placeholder="Select prize..."
              menuPortalTarget={document.body}
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, fontSize: 14, borderRadius: 8 }) }}
            />
          </div>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Card Image (optional)</span>
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0] || null)}
              className="block w-full text-xs text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-semibold hover:file:bg-gray-200" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Note (optional)</span>
            <textarea value={form.note} onChange={set('note')} rows={2} className={`${CREATE_INPUT} resize-none`} />
          </label>
          <p className="text-[11px] text-gray-400">এই phone থেকে আগে claim থাকলে এটা Repeat Scratch Card-এ যাবে।</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="border border-gray-300 text-gray-600 text-sm font-semibold px-5 py-2 rounded-lg hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded-lg transition">
              {saving ? 'Saving...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CrossProductEditor({ row, options, loading, error, onRetry, onSave }) {
  const [saving, setSaving] = useState(false);
  const value = normalizeCrossProducts(row.crossProducts).map((product) =>
    options.find((option) => option.value === product.Id) || { value: product.Id, label: product.name });

  async function save(selected) {
    setSaving(true);
    try {
      await onSave((selected || []).map((option) => option.value));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[240px] max-w-[320px]">
      <Select
        isMulti isClearable closeMenuOnSelect={false}
        options={options} value={value} onChange={save}
        isLoading={loading || saving} isDisabled={loading || saving || Boolean(error)}
        placeholder="Select products"
        aria-label={`Cross Product for ${row.fullName} (${row.referenceCode || row.Id})`}
        menuPortalTarget={document.body} menuPosition="fixed"
        styles={{
          ...FILTER_SELECT_STYLES,
          control: (base, state) => ({ ...FILTER_SELECT_STYLES.control(base, state), height: 'auto' }),
          menuPortal: (base) => ({ ...base, zIndex: 50 }),
        }}
      />
      {saving && <p className="mt-1 text-[11px] text-gray-500" role="status">Saving...</p>}
      {error && <p className="mt-1 text-[11px] text-red-600" role="alert">
        {error} <button type="button" className="underline" onClick={onRetry}>Retry</button>
      </p>}
    </div>
  );
}

function PreviousClaims({ claims = [] }) {
  if (!claims.length) return <span className="text-gray-400">—</span>;
  return (
    <ul className="space-y-1.5 min-w-[170px]">
      {claims.map((claim) => (
        <li key={claim.Id} className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
          <div className="font-semibold text-gray-700">{claim.prize}</div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
            <span>{formatDate(claim.createdAt)}</span>
            <span className={`rounded-full border px-1.5 ${STATUS_STYLES[claim.status] || 'border-gray-200'}`}>{claim.status}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Claims made before the rename still store the old wall watch name.
const LEGACY_PRIZE_NAMES = { 'Big Size Wall Watch': 'Luxury Wall Watch' };

function PrizeBadge({ prize }) {
  return (
    <span className="inline-block rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 font-semibold whitespace-nowrap">
      {LEGACY_PRIZE_NAMES[prize] || prize}
    </span>
  );
}

// Inline prize edit: the admin picks one of the form's prizes to fix a
// misspelt or wrong prize. Escape cancels.
function PrizeEditor({ row, saving, onSave }) {
  const prizeOptions = usePrizeOptions();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(null);

  function start() {
    const current = LEGACY_PRIZE_NAMES[row.prize] || row.prize;
    setValue(prizeOptions.find((o) => o.value === current) || null);
    setEditing(true);
  }

  async function save() {
    const prize = value?.value;
    if (!prize) return alert('একটি prize নির্বাচন করুন');
    if (prize === row.prize) return setEditing(false);
    if (await onSave(prize)) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <PrizeBadge prize={row.prize} />
        <button type="button" title="Edit prize" onClick={start}
          className="w-6 h-6 shrink-0 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 flex items-center justify-center transition">
          <Pencil size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="w-44">
        <Select
          options={prizeOptions}
          value={value}
          onChange={setValue}
          placeholder="Select prize"
          autoFocus
          openMenuOnFocus
          isDisabled={saving}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
          menuPortalTarget={document.body}
          styles={{ ...FILTER_SELECT_STYLES, menuPortal: (base) => ({ ...base, zIndex: 50 }) }}
        />
      </div>
      <button type="button" title="Save" onClick={save} disabled={saving}
        className="w-6 h-6 shrink-0 rounded bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white flex items-center justify-center transition">
        <Check size={12} />
      </button>
      <button type="button" title="Cancel" onClick={() => setEditing(false)} disabled={saving}
        className="w-6 h-6 shrink-0 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 flex items-center justify-center transition">
        <X size={12} />
      </button>
    </div>
  );
}

// Inline address edit for a card not yet sent to a courier. Escape cancels.
function AddressEditor({ row, saving, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  function start() {
    setValue(row.address || '');
    setEditing(true);
  }

  async function save() {
    const address = value.trim();
    if (!address) return alert('Address লিখুন');
    if (isShortAddress(address)) return alert('পুরো ঠিকানা লিখুন (গ্রাম/এলাকা, থানা, জেলা) — কমপক্ষে ১০ অক্ষর');
    if (address === row.address) return setEditing(false);
    if (await onSave(address)) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-1.5">
        <div>
          <span className={isShortAddress(row.address) ? 'text-red-600 font-medium' : undefined}>{row.address}</span>
          {isShortAddress(row.address) && (
            <p className="text-[11px] text-red-500">ঠিকানা ছোট — Pathao নেবে না</p>
          )}
        </div>
        <button type="button" title="Edit address" onClick={start}
          className="w-6 h-6 shrink-0 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 flex items-center justify-center transition">
          <Pencil size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1">
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} autoFocus disabled={saving}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
        className="w-52 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-purple-400 disabled:opacity-50" />
      <div className="flex flex-col gap-1">
        <button type="button" title="Save" onClick={save} disabled={saving}
          className="w-6 h-6 shrink-0 rounded bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white flex items-center justify-center transition">
          <Check size={12} />
        </button>
        <button type="button" title="Cancel" onClick={() => setEditing(false)} disabled={saving}
          className="w-6 h-6 shrink-0 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 flex items-center justify-center transition">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

// The customer pays only the delivery charge; the courier collects it as COD.
// Inside/outside Dhaka is guessed from the address, and an admin can correct it
// or type a custom amount until the card is sent. After that it shows the amount
// actually sent. Picking an area again drops the custom amount.
function DeliveryCharge({ row, charges, editable, saving, onChange, onSaveAmount }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const amount = <span className="font-semibold text-gray-800">৳{Number(row.deliveryCharge ?? 0)}</span>;

  async function saveAmount() {
    const next = Number(value);
    if (value === '' || !Number.isFinite(next) || next < 0) return alert('সঠিক delivery charge লিখুন');
    if (next === Number(row.deliveryCharge)) return setEditing(false);
    if (await onSaveAmount(next)) setEditing(false);
  }

  if (!editable) {
    return (
      <>
        {amount}
        <div className="mt-0.5 text-[11px] text-gray-500">
          {row.deliveryArea === 'inside' ? 'ঢাকার ভিতরে' : 'ঢাকার বাইরে'}{row.courier && ' · COD'}
        </div>
      </>
    );
  }
  return (
    <>
      {editing ? (
        <div className="flex items-center gap-1">
          <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} autoFocus disabled={saving}
            onKeyDown={(e) => { if (e.key === 'Enter') saveAmount(); if (e.key === 'Escape') setEditing(false); }}
            className="w-20 text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-purple-400 disabled:opacity-50" />
          <button type="button" title="Save" onClick={saveAmount} disabled={saving}
            className="w-6 h-6 shrink-0 rounded bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white flex items-center justify-center transition">
            <Check size={12} />
          </button>
          <button type="button" title="Cancel" onClick={() => setEditing(false)} disabled={saving}
            className="w-6 h-6 shrink-0 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 flex items-center justify-center transition">
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {amount}
          {row.codAmount != null && <span className="text-[10px] text-purple-600">custom</span>}
          <button type="button" title="Edit delivery charge"
            onClick={() => { setValue(String(Number(row.deliveryCharge ?? 0))); setEditing(true); }}
            className="w-6 h-6 shrink-0 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 flex items-center justify-center transition">
            <Pencil size={12} />
          </button>
        </div>
      )}
      <select value={row.deliveryArea} disabled={saving} onChange={(e) => onChange(e.target.value)}
        className="mt-1 block text-[11px] border border-gray-300 rounded px-1.5 py-0.5 bg-white focus:outline-none disabled:opacity-50">
        <option value="inside">ঢাকার ভিতরে{charges ? ` (৳${charges.inside})` : ''}</option>
        <option value="outside">ঢাকার বাইরে{charges ? ` (৳${charges.outside})` : ''}</option>
      </select>
    </>
  );
}

function FilterField({ label, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

// Date inputs have a wide built-in minimum width, so they need min-w-0 to
// share the space without spilling into the next field.
function DateRange({ label, from, to, onFrom, onTo, className }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span className="mb-1 block text-[11px] font-semibold text-gray-600">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="date" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)}
          title={`${label} from`} aria-label={`${label} from`} className={className} style={{ flex: 1, minWidth: 0 }} />
        <span className="text-xs text-gray-400" style={{ flexShrink: 0 }}>to</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)}
          title={`${label} to`} aria-label={`${label} to`} className={className} style={{ flex: 1, minWidth: 0 }} />
      </div>
    </div>
  );
}

const PAGE_SIZES = [10, 20, 50, 100, 500, 1000, 2000];
const MAX_PAGE_SIZE = 5000; // the scratch card API allows up to this many

// Rows per page: preset sizes, or "Custom" for any number up to MAX_PAGE_SIZE.
function PageSizePicker({ value, onChange }) {
  const [custom, setCustom] = useState(!PAGE_SIZES.includes(value));
  const [draft, setDraft] = useState(String(value));
  const fieldClass = 'h-9 text-sm border border-gray-300 rounded-md px-2 bg-white text-gray-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200';

  function applyDraft() {
    const n = Math.min(Math.max(Math.floor(Number(draft)) || 0, 1), MAX_PAGE_SIZE);
    if (!Number(draft)) return setDraft(String(value));
    setDraft(String(n));
    if (n !== value) onChange(n);
  }

  return (
    <label className="flex items-center gap-2">
      <span>Per page</span>
      <select value={custom ? 'custom' : value} className={fieldClass}
        onChange={(e) => {
          if (e.target.value === 'custom') { setCustom(true); setDraft(String(value)); return; }
          setCustom(false);
          onChange(Number(e.target.value));
        }}>
        {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        <option value="custom">Custom</option>
      </select>
      {custom && (
        <input type="number" min={1} max={MAX_PAGE_SIZE} value={draft} autoFocus
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={applyDraft}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className={`${fieldClass} w-24`} placeholder={`1–${MAX_PAGE_SIZE}`} />
      )}
    </label>
  );
}

function PagBtn({ onClick, disabled, label, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      className={`h-9 px-3 rounded-md border flex items-center gap-1 text-sm font-medium transition ${disabled ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'}`}>
      {children}
    </button>
  );
}

// Up to 10 consecutive page numbers with the current page kept near the
// middle: page 10 of 13 shows 4–13, page 6 of 30 shows 1–10.
const VISIBLE_PAGES = 10;
function paginationItems(page, totalPages) {
  const count = Math.min(VISIBLE_PAGES, totalPages);
  const first = Math.max(1, Math.min(page - Math.floor(VISIBLE_PAGES / 2) + 1, totalPages - count + 1));
  return Array.from({ length: count }, (_, i) => first + i);
}
