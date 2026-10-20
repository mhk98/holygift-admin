import { useState, useEffect, useCallback } from 'react';
import Select from 'react-select';
import { X, Trash2, StickyNote, Pencil, Check, Filter, RotateCcw, Search, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { scratchCardService } from '../../services/scratchCardService';
import { imageUrl } from '../../utils/assetUrl';
import { useAuth } from '../../context/AuthContext';
import PathaoStickerSheet from './PathaoStickerSheet';

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
const COURIERS_FOR_FILTER = ['Steadfast', 'Pathao'];

// The prizes on the storefront form; must match PRIZES in the frontend's ScratchCardClient.tsx.
const PRIZES = ['TV', 'Fridge', 'Rice Cooker', 'Induction Chula', 'Luxury Wall Watch'];

const PRIZE_OPTIONS = PRIZES.map((p) => ({ value: p, label: p }));

// Courier status filter values, matching courierStatusCondition in the backend.
const COURIER_FILTER_BASE = [
  {
    label: 'Courier',
    options: [
      { value: 'none', label: 'Not sent to courier' },
      ...COURIERS_FOR_FILTER.map((c) => ({ value: `courier:${c}`, label: `Sent to ${c}` })),
    ],
  },
  {
    label: 'Stage',
    options: [
      { value: 'stage:in_courier', label: 'In Courier' },
      { value: 'stage:on_hold', label: 'On Hold' },
      { value: 'stage:delivered', label: 'Delivered' },
      { value: 'stage:returned', label: 'Returned' },
      { value: 'stage:cancelled', label: 'Cancelled' },
    ],
  },
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

const COURIERS = [
  { key: 'steadfast', label: 'Steadfast' },
  { key: 'pathao', label: 'Pathao' },
];

// One line per card the courier didn't take, so the admin knows what to fix.
function courierSummary(title, done, problems) {
  const lines = [`${title}: ${done}`];
  if (problems.length) {
    lines.push('', 'পাঠানো যায়নি:');
    problems.forEach((p) => lines.push(`• ${p.reference}: ${p.message}`));
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
  const isRepeat = claimType === 'repeat';
  const copy = PAGE_COPY[claimType] || PAGE_COPY.first;
  const { user } = useAuth();
  // Admins assign claims to agents; an agent's list only holds their own
  // claims (the backend enforces this).
  const userRole = String(user?.role || '').trim().toLowerCase();
  const canAssign = ['superadmin', 'admin'].includes(userRole);
  // Leaders see and work every claim like an admin, but cannot assign or delete.
  const canViewAll = canAssign || userRole === 'leader';
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
  const [prize, setPrize]       = useState('');
  const [courierStatus, setCourierStatus] = useState('');
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

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await scratchCardService.getAll({
        searchTerm: search || undefined,
        reference: reference.trim() || undefined,
        phone: phone.trim() || undefined,
        status: status || undefined,
        prize: prize || undefined,
        courierStatus: courierStatus || undefined,
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
  }, [search, reference, phone, status, prize, courierStatus, submittedFrom, submittedTo, approvedFrom, approvedTo, agentFilter, claimType, page, limit]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    if (!canViewAll) return;
    scratchCardService.getAgents()
      .then((res) => { setAgents(res.data || []); setAgentsError(''); })
      .catch((err) => { setAgents([]); setAgentsError(err.message || 'Agent list load failed'); });
  }, [canViewAll]);

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
    try {
      const res = await scratchCardService.sendToCourier(provider.key, selectedIds);
      const { sent = [], skipped = [] } = res.data || {};
      alert(courierSummary(`${provider.label} এ পাঠানো হয়েছে`, sent.length, skipped));
      fetchRows();
    } catch (err) {
      alert(err.message);
    } finally {
      setCourierBusy(false);
    }
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
    const printable = selected.filter((row) => row.courier === 'Pathao' && (row.consignmentId || row.trackingCode));
    if (!printable.length) return alert('Select করা কোনো card Pathao তে পাঠানো হয়নি। আগে Send to Pathao করুন।');
    const skipped = selected.length - printable.length;
    if (skipped && !window.confirm(`${skipped} টি card Pathao তে পাঠানো হয়নি, সেগুলো বাদ যাবে। বাকি ${printable.length} টি sticker print করবেন?`)) return;
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
    'SL', 'Reference', 'Consignment ID', 'Date', 'Card Image', 'Full Name', 'Phone', 'Delivered Address', 'Prize', 'Delivery Charge',
    ...(isRepeat ? ['Previous Claims'] : []),
    ...(canViewAll ? ['Assigned To'] : []),
    'Status', 'Action',
  ];
  const colCount = columns.length + (canViewAll ? 1 : 0);
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.Id));
  const filterClass = 'w-full h-9 text-xs border border-gray-300 rounded-md px-2.5 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200';
  const filterValues = [search, reference, phone, status, prize, courierStatus, agentFilter, submittedFrom, submittedTo, approvedFrom, approvedTo];
  const activeFilterCount = filterValues.filter(Boolean).length;

  const statusOptions = (meta?.statuses?.length ? meta.statuses : STATUSES).map((st) => ({ value: st, label: st }));

  // The exact statuses come from the cards already with a courier.
  const courierStatusOptions = [
    ...COURIER_FILTER_BASE,
    ...(meta?.courierStatuses?.length
      ? [{ label: 'Exact Status', options: meta.courierStatuses.map((st) => ({ value: `status:${st}`, label: st })) }]
      : []),
  ];
  const selectedCourierStatus = courierStatusOptions.flatMap((g) => g.options).find((o) => o.value === courierStatus) || null;

  const agentOptions = [
    { value: 'unassigned', label: 'Not Assigned' },
    ...agents.map((a) => ({ value: String(a.Id), label: `${a.name}${a.role ? ` (${a.role})` : ''}` })),
  ];

  function resetFilters() {
    [setSearch, setReference, setPhone, setStatus, setPrize, setCourierStatus, setAgentFilter,
      setSubmittedFrom, setSubmittedTo, setApprovedFrom, setApprovedTo].forEach((set) => set(''));
    setPage(1);
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
      <div>
        <h1 className="text-lg font-bold text-gray-800">{copy.title}</h1>
        <p className="mt-1 text-xs text-gray-500">{copy.subtitle}</p>
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
            {/* Reference finds one claim; phone finds every claim from that number, first and repeat. */}
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
                value={status ? { value: status, label: status } : null}
                onChange={(opt) => { setStatus(opt?.value || ''); setPage(1); }}
                placeholder="All Status"
                isClearable
                styles={FILTER_SELECT_STYLES}
              />
            </FilterField>
            <FilterField label="Courier Status">
              <Select
                options={courierStatusOptions}
                value={selectedCourierStatus}
                onChange={(opt) => { setCourierStatus(opt?.value || ''); setPage(1); }}
                placeholder="All"
                isClearable
                styles={FILTER_SELECT_STYLES}
              />
            </FilterField>
            <FilterField label="Prize">
              <Select
                options={PRIZE_OPTIONS}
                value={prize ? { value: prize, label: prize } : null}
                onChange={(opt) => { setPrize(opt?.value || ''); setPage(1); }}
                placeholder="All Prizes"
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
            <select value={assignAgentId} onChange={(e) => setAssignAgentId(e.target.value)}
              className="h-8 text-xs border border-gray-300 rounded-md px-2 bg-white focus:outline-none focus:border-indigo-400">
              <option value="">Select Agent</option>
              {agents.map((a) => <option key={a.Id} value={a.Id}>{a.name}{a.role ? ` (${a.role})` : ''}</option>)}
              <option value="none">— Remove assignment —</option>
            </select>
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
              {!loading && !error && rows.map((row, i) => (
                <tr key={row.Id} className="border-b border-gray-50 hover:bg-gray-50/60 transition align-top">
                  {canViewAll && (
                    <td className="pl-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(row.Id)} onChange={() => toggleSelected(row.Id)} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-500">{(page - 1) * limit + i + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-mono font-semibold text-gray-800">{row.referenceCode || '—'}</div>
                    {(reference || phone) && (
                      <div className="mt-1 text-[11px] text-gray-500">{row.claimType === 'repeat' ? 'Repeat card' : 'First card'}</div>
                    )}
                  </td>
                  {/* Set once the card is sent to Pathao/Steadfast; Steadfast also gives a separate tracking code. */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.consignmentId ? (
                      <>
                        <div className="font-mono font-semibold text-gray-800">{row.consignmentId}</div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          {row.courier}
                          {row.trackingCode && row.trackingCode !== row.consignmentId && (
                            <> · Tracking <span className="font-mono">{row.trackingCode}</span></>
                          )}
                        </div>
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
                  <td className="px-4 py-3 text-gray-600 max-w-[260px] whitespace-pre-line break-words">{row.address}</td>
                  <td className="px-4 py-3">
                    {canViewAll ? (
                      <PrizeEditor row={row} saving={savingId === row.Id}
                        onSave={(prize) => updateRow(row, { prize })} />
                    ) : (
                      <PrizeBadge prize={row.prize} />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DeliveryCharge row={row} charges={meta?.deliveryCharges}
                      editable={canViewAll && !row.courier} saving={savingId === row.Id}
                      onChange={(deliveryArea) => updateRow(row, { deliveryArea })} />
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
                    {row.courier ? (
                      <>
                        <span className={`inline-block rounded-full border px-2.5 py-1 font-semibold whitespace-nowrap ${STATUS_STYLES[row.status] || COURIER_STATUS_STYLE}`}>
                          {row.status}
                        </span>
                        <p className="mt-1.5 text-[11px] text-gray-500 whitespace-nowrap">
                          {row.courier}
                        </p>
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
                      <button type="button" title="Note" onClick={() => setNoteTarget({ ...row })}
                        className="w-7 h-7 rounded bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center transition">
                        <StickyNote size={12} />
                      </button>
                      {canAssign && (
                        <button type="button" title="Delete" onClick={() => handleDelete(row)}
                          className="w-7 h-7 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
      {stickerCards.length > 0 && <PathaoStickerSheet cards={stickerCards} />}

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
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(null);

  function start() {
    const current = LEGACY_PRIZE_NAMES[row.prize] || row.prize;
    setValue(PRIZE_OPTIONS.find((o) => o.value === current) || null);
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
          options={PRIZE_OPTIONS}
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

// The customer pays only the delivery charge; the courier collects it as COD.
// Inside/outside Dhaka is guessed from the address, and an admin can correct it
// until the card is sent. After that it shows the amount actually sent.
function DeliveryCharge({ row, charges, editable, saving, onChange }) {
  const amount = <span className="font-semibold text-gray-800">৳{Number(row.deliveryCharge ?? 0)}</span>;
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
      {amount}
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
