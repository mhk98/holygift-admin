import { useState } from 'react';
import { Copy, Printer, FileText, Pencil, Eye, Trash2, ShieldOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOrders } from '../../hooks/useOrders';
import { orderService } from '../../services/orderService';

export default function CustomerListPage({ onViewCustomer, onEditCustomer }) {
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [query, setQuery]     = useState({ search: '', page: 1, limit: 20 });

  const { orders, meta, loading, error, refetch } = useOrders(query);

  function applySearch() {
    setQuery((q) => ({ ...q, search, page: 1 }));
    setPage(1);
  }

  async function handleDelete(o) {
    if (!window.confirm(`Delete order "${o.orderId}"?`)) return;
    try {
      await orderService.deleteOrder(o.Id);
      refetch();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleBlock(o) {
    const nextStatus = o.status === 'Cancelled' ? 'Pending' : 'Cancelled';
    try {
      await orderService.updateOrderStatus(o.Id, nextStatus);
      refetch();
    } catch (err) {
      alert(err.message);
    }
  }

  const totalPages = meta?.totalPage ?? Math.max(1, Math.ceil((meta?.count ?? 0) / (query.limit)));

  function goPage(p) {
    const next = Math.max(1, Math.min(totalPages, p));
    setPage(next);
    setQuery((q) => ({ ...q, page: next }));
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Customer List</h1>
        <button type="button"
          className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition">
          ▶ টিউটোরিয়াল দেখুন
        </button>
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
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              onBlur={applySearch}
              className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 w-44"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['SL', 'Order ID', 'Customer Name', 'Phone', 'Area', 'Status', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-gray-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td></tr>
              )}
              {!loading && error && (
                <tr><td colSpan={7} className="text-center py-10 text-red-400">{error}</td></tr>
              )}
              {!loading && !error && orders.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No data available in table</td></tr>
              )}
              {!loading && orders.map((o, i) => (
                <tr key={o.Id} className="border-b border-gray-50 hover:bg-gray-50/60 transition">
                  <td className="px-4 py-3 text-gray-500">{(page - 1) * query.limit + i + 1}</td>
                  <td className="px-4 py-3 font-mono text-gray-600 text-[11px]">{o.orderId}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{o.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">{o.customerPhone}</td>
                  <td className="px-4 py-3 text-gray-500">{[o.customerArea, o.customerDistrict].filter(Boolean).join(', ')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-semibold ${
                      o.status === 'Delivered'  ? 'bg-teal-100 text-teal-700'    :
                      o.status === 'Cancelled'  ? 'bg-orange-100 text-orange-700' :
                      o.status === 'Returned'   ? 'bg-red-100 text-red-600'      :
                      o.status === 'Confirmed'  ? 'bg-blue-100 text-blue-700'    :
                                                  'bg-gray-100 text-gray-600'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <ActionBtn icon={<ShieldOff size={12} />}
                        title={o.status === 'Cancelled' ? 'Unblock' : 'Block'}
                        color="bg-gray-500 hover:bg-gray-600"
                        onClick={() => handleBlock(o)} />
                      <ActionBtn icon={<Pencil size={12} />} title="Edit"
                        color="bg-indigo-500 hover:bg-indigo-600"
                        onClick={() => onEditCustomer && onEditCustomer(o)} />
                      <ActionBtn icon={<Eye size={12} />} title="View"
                        color="bg-teal-500 hover:bg-teal-600"
                        onClick={() => onViewCustomer && onViewCustomer(o)} />
                      <ActionBtn icon={<Trash2 size={12} />} title="Delete"
                        color="bg-pink-500 hover:bg-pink-600"
                        onClick={() => handleDelete(o)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Total {meta?.count ?? orders.length} entries
          </span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => goPage(1)} disabled={page === 1} label="«" />
            <PagBtn onClick={() => goPage(page - 1)} disabled={page === 1} label="‹" />
            <span className="w-16 text-center text-xs text-gray-600">
              {page} / {totalPages}
            </span>
            <PagBtn onClick={() => goPage(page + 1)} disabled={page >= totalPages} label="›" />
            <PagBtn onClick={() => goPage(totalPages)} disabled={page >= totalPages} label="»" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, title, color, onClick }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`w-7 h-7 rounded text-white flex items-center justify-center transition ${color}`}>
      {icon}
    </button>
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
