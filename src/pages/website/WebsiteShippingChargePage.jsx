import { useState, useEffect, useCallback } from 'react';
import { Copy, Printer, FileText, Pencil, X, Info } from 'lucide-react';
import { chargeSettingService } from '../../services/websiteService';

const CHARGE_TYPE = 'delivery';

export default function WebsiteShippingChargePage({ onEdit, onCreate }) {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [meta, setMeta]       = useState({});
  const limit = 20;

  const fetchCharges = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await chargeSettingService.getAll(CHARGE_TYPE, {
        searchTerm: search || undefined,
        page,
        limit,
      });
      setCharges(res.data || []);
      setMeta(res.meta || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchCharges(); }, [fetchCharges]);

  async function handleDelete(c) {
    if (!window.confirm('Delete this charge?')) return;
    try {
      await chargeSettingService.delete(c.Id, CHARGE_TYPE);
      fetchCharges();
    } catch (err) {
      alert(err.message);
    }
  }

  const totalPages = meta?.totalPage ?? Math.max(1, Math.ceil((meta?.count ?? 0) / limit));

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-gray-800">Shipping Charge Manage</h1>
        <div className="flex gap-2">
          <button type="button"
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-4 py-2 rounded-lg transition">
            ▶ টিউটোরিয়াল দেখুন
          </button>
          <button type="button" onClick={onCreate}
            className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition">
            Create
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100">
          <div className="flex gap-2">
            {[['Copy', Copy], ['Print', Printer], ['PDF', FileText]].map(([label, Icon]) => (
              <button key={label}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Search:</span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 w-44"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['SL', 'Area / Note', 'Amount', 'Date', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-gray-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center py-10 text-gray-400">Loading...</td></tr>}
              {!loading && error && <tr><td colSpan={5} className="text-center py-10 text-red-400">{error}</td></tr>}
              {!loading && !error && charges.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">No records found</td></tr>
              )}
              {!loading && charges.map((c, i) => (
                <tr key={c.Id} className="border-b border-gray-50 hover:bg-gray-50/60 transition">
                  <td className="px-4 py-3 text-gray-500">{(page - 1) * limit + i + 1}</td>
                  <td className="px-4 py-3 text-gray-800">{c.note ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">৳{Number(c.amount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">{c.date ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button type="button" title="Details"
                        className="w-7 h-7 rounded bg-gray-400 hover:bg-gray-500 text-white flex items-center justify-center transition">
                        <Info size={12} />
                      </button>
                      <button type="button" title="Edit" onClick={() => onEdit && onEdit(c)}
                        className="w-7 h-7 rounded bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition">
                        <Pencil size={12} />
                      </button>
                      <button type="button" title="Delete" onClick={() => handleDelete(c)}
                        className="w-7 h-7 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition">
                        <X size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Total {meta?.count ?? charges.length} entries
          </span>
          <div className="flex gap-1">
            <PagBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} label="‹" />
            <button className="w-7 h-7 rounded bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
              {page}
            </button>
            <PagBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} label="›" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PagBtn({ onClick, disabled, label }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-xs transition ${
        disabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'
      }`}>
      {label}
    </button>
  );
}
