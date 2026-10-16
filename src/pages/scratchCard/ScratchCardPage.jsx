import { useState, useEffect, useCallback } from 'react';
import { X, Trash2, StickyNote, Pencil, Check, Filter, RotateCcw, Search } from 'lucide-react';
import { scratchCardService } from '../../services/scratchCardService';
import { imageUrl } from '../../utils/assetUrl';
import { useAuth } from '../../context/AuthContext';

// Statuses set by hand; must match SCRATCH_CARD_STATUSES in the backend. Once a
// card is sent to Steadfast/Pathao its status is the courier's own.
const STATUSES = ['Pending', 'Approved', 'Rejected'];

const STATUS_STYLES = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-blue-50 text-blue-700 border-blue-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
  Delivered: 'bg-green-50 text-green-700 border-green-200',
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
  const canAssign = ['superadmin', 'admin'].includes(String(user?.role || '').trim().toLowerCase());
  const [agents, setAgents]     = useState([]);
  const [agentsError, setAgentsError] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [courierBusy, setCourierBusy] = useState(false);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [reference, setReference] = useState('');
  const [phone, setPhone]       = useState('');
  const [status, setStatus]     = useState('');
  const [submittedFrom, setSubmittedFrom] = useState('');
  const [submittedTo, setSubmittedTo]     = useState('');
  const [approvedFrom, setApprovedFrom]   = useState('');
  const [approvedTo, setApprovedTo]       = useState('');
  const [page, setPage]         = useState(1);
  const [meta, setMeta]         = useState({});
  const [preview, setPreview]   = useState(null);
  const [noteTarget, setNoteTarget] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const limit = 10;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await scratchCardService.getAll({
        searchTerm: search || undefined,
        reference: reference.trim() || undefined,
        phone: phone.trim() || undefined,
        status: status || undefined,
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
  }, [search, reference, phone, status, submittedFrom, submittedTo, approvedFrom, approvedTo, agentFilter, claimType, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    if (!canAssign) return;
    scratchCardService.getAgents()
      .then((res) => { setAgents(res.data || []); setAgentsError(''); })
      .catch((err) => { setAgents([]); setAgentsError(err.message || 'Agent list load failed'); });
  }, [canAssign]);

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
  // Page numbers in blocks of 10 (1–10, 11–20, ...); Next past the end of a
  // block moves on to the next block.
  const firstShown = Math.floor((page - 1) / 10) * 10 + 1;
  const pageNumbers = Array.from({ length: Math.min(10, totalPages - firstShown + 1) }, (_, i) => firstShown + i);
  const columns = [
    'SL', 'Reference', 'Date', 'Card Image', 'Full Name', 'Phone', 'Delivered Address', 'Prize', 'Delivery Charge',
    ...(isRepeat ? ['Previous Claims'] : []),
    ...(canAssign ? ['Assigned To'] : []),
    'Status', 'Action',
  ];
  const colCount = columns.length + (canAssign ? 1 : 0);
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.Id));
  const filterClass = 'w-full h-9 text-xs border border-gray-300 rounded-md px-2.5 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200';
  const filterValues = [search, reference, phone, status, agentFilter, submittedFrom, submittedTo, approvedFrom, approvedTo];
  const activeFilterCount = filterValues.filter(Boolean).length;

  function resetFilters() {
    [setSearch, setReference, setPhone, setStatus, setAgentFilter,
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
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={filterClass}>
                <option value="">All Status</option>
                {(meta?.statuses?.length ? meta.statuses : STATUSES).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FilterField>
            {canAssign && (
              <FilterField label="Agent">
                <select value={agentFilter} onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }} className={filterClass}>
                  <option value="">All Agents</option>
                  <option value="unassigned">Not Assigned</option>
                  {agents.map((a) => <option key={a.Id} value={a.Id}>{a.name}</option>)}
                </select>
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

        {canAssign && (
          <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60">
            <span className="text-xs text-gray-600">{selectedIds.length} selected · Assign To:</span>
            <select value={assignAgentId} onChange={(e) => setAssignAgentId(e.target.value)}
              className="h-8 text-xs border border-gray-300 rounded-md px-2 bg-white focus:outline-none focus:border-indigo-400">
              <option value="">Select Agent</option>
              {agents.map((a) => <option key={a.Id} value={a.Id}>{a.name}</option>)}
              <option value="none">— Remove assignment —</option>
            </select>
            <button type="button" onClick={handleAssign} disabled={assigning || !selectedIds.length}
              className="rounded-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-1.5 transition">
              {assigning ? 'Assigning...' : 'Assign Selected'}
            </button>
            {agentsError ? (
              <span className="text-[11px] text-red-500">Agent list load হয়নি: {agentsError}</span>
            ) : !agents.length && (
              <span className="text-[11px] text-gray-400">No active user with the Agent role yet</span>
            )}
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
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {canAssign && (
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
                  {canAssign && (
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
                    {canAssign ? (
                      <PrizeEditor row={row} saving={savingId === row.Id}
                        onSave={(prize) => updateRow(row, { prize })} />
                    ) : (
                      <PrizeBadge prize={row.prize} />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DeliveryCharge row={row} charges={meta?.deliveryCharges}
                      editable={canAssign && !row.courier} saving={savingId === row.Id}
                      onChange={(deliveryArea) => updateRow(row, { deliveryArea })} />
                  </td>
                  {isRepeat && (
                    <td className="px-4 py-3">
                      <PreviousClaims claims={row.previousClaims} />
                    </td>
                  )}
                  {canAssign && (
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
                          {row.courier}{row.trackingCode && <> · <span className="font-mono">{row.trackingCode}</span></>}
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
          <div className="flex flex-wrap justify-center gap-1">
            <PagBtn onClick={() => setPage(1)} disabled={page === 1} label="«" />
            <PagBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} label="‹" />
            {pageNumbers.map((n) => (
              <button key={n} type="button" onClick={() => setPage(n)}
                className={`min-w-7 h-7 px-1.5 rounded text-xs font-semibold flex items-center justify-center transition ${
                  n === page ? 'bg-indigo-500 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {n}
              </button>
            ))}
            <PagBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} label="›" />
            <PagBtn onClick={() => setPage(totalPages)} disabled={page >= totalPages} label="»" />
          </div>
          <span className="text-xs text-gray-500">
            {totalCount
              ? `Showing ${(page - 1) * limit + 1} to ${Math.min(page * limit, totalCount)} of ${totalCount} entries`
              : 'Total 0 entries'}
          </span>
        </div>
      </div>

      {/* Image preview */}
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

function PrizeBadge({ prize }) {
  return (
    <span className="inline-block rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 font-semibold whitespace-nowrap">
      {prize}
    </span>
  );
}

// Inline prize edit: Enter saves, Escape cancels. Max length matches the backend (64).
function PrizeEditor({ row, saving, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.prize);

  function start() {
    setValue(row.prize);
    setEditing(true);
  }

  async function save() {
    const prize = value.trim();
    if (!prize) return alert('Prize name খালি রাখা যাবে না');
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
      <input value={value} autoFocus maxLength={64} disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-36 text-xs border border-purple-300 rounded px-2 py-1 focus:outline-none focus:border-purple-500 disabled:opacity-50" />
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

function PagBtn({ onClick, disabled, label }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-xs transition ${disabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'}`}>
      {label}
    </button>
  );
}
