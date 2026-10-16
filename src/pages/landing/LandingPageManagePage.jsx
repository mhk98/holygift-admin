import { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  ChevronDown,
  Search,
  Eye,
  Edit2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { landingPageService } from "../../services/landingPageService";

const PAGE_SIZES = [10, 20, 30, 50];
const FRONTEND_SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://holydeen.com"
).replace(/\/+$/, "");

function getFrontendLandingUrl(id) {
  return `${FRONTEND_SITE_URL}/landing-page/${encodeURIComponent(String(id))}`;
}

export default function LandingPageManagePage({
  onNavigate,
  onViewCampaign,
  onEditCampaign,
}) {
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState([]);
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    landingPageService
      .getAll({ searchTerm: appliedSearch, page, limit: perPage })
      .then((res) => {
        if (active) {
          setCampaigns(res.data || []);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "Landing pages fetch failed.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appliedSearch, page, perPage]);

  const filtered = useMemo(() => {
    if (!appliedSearch.trim()) return campaigns;
    const q = appliedSearch.toLowerCase();
    return campaigns.filter(
      (c) =>
        String(c.title || "")
          .toLowerCase()
          .includes(q) ||
        String(c.product || "")
          .toLowerCase()
          .includes(q) ||
        String(c.template || "")
          .toLowerCase()
          .includes(q),
    );
  }, [appliedSearch, campaigns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  function toggleAll() {
    if (selected.length === paged.length && paged.length > 0) setSelected([]);
    else setSelected(paged.map((c) => c.Id));
  }

  function toggleOne(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function deleteSelected() {
    Promise.all(selected.map((id) => landingPageService.delete(id)))
      .then(() => {
        setCampaigns((prev) => prev.filter((c) => !selected.includes(c.Id)));
        setSelected([]);
      })
      .catch((err) => setError(err.message || "Delete failed."));
  }

  function deleteSingle(id) {
    landingPageService
      .delete(id)
      .then(() => {
        setCampaigns((prev) => prev.filter((c) => c.Id !== id));
        setSelected((prev) => prev.filter((x) => x !== id));
      })
      .catch((err) => setError(err.message || "Delete failed."));
  }

  function toggleStatus(id) {
    const campaign = campaigns.find((c) => c.Id === id);
    if (!campaign) return;
    landingPageService
      .update(id, { ...campaign, status: !campaign.status })
      .then((res) => {
        const updated = res.data || { ...campaign, status: !campaign.status };
        setCampaigns((prev) => prev.map((c) => (c.Id === id ? updated : c)));
      })
      .catch((err) => setError(err.message || "Status update failed."));
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Landing Page Manage</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate && onNavigate("landing_create")}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-4 py-2 rounded-lg transition"
          >
            Create
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-xl shadow p-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={deleteSelected}
          className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded transition"
        >
          <Trash2 size={13} />
          Delete{selected.length > 0 ? ` (${selected.length})` : ""}
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium px-3 py-1.5 rounded transition"
        >
          Action
          <ChevronDown size={13} />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
            className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-600 w-48 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            type="button"
            onClick={() => {
              setAppliedSearch(search);
              setPage(1);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-1.5 rounded flex items-center gap-1 transition"
          >
            <Search size={12} />
            Submit
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          {error && (
            <div className="px-4 py-3 text-xs text-red-500">{error}</div>
          )}
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={
                      selected.length === paged.length && paged.length > 0
                    }
                    onChange={toggleAll}
                    className="rounded accent-blue-600"
                  />
                </th>
                <th className="px-3 py-3 text-left text-gray-500 font-semibold w-8">
                  #
                </th>
                <th className="px-3 py-3 text-left text-gray-500 font-semibold">
                  Product
                </th>
                <th className="px-3 py-3 text-left text-gray-500 font-semibold">
                  Campaign Title
                </th>
                <th className="px-3 py-3 text-left text-gray-500 font-semibold">
                  Template
                </th>
                <th className="px-3 py-3 text-left text-gray-500 font-semibold">
                  Countdown
                </th>
                <th className="px-3 py-3 text-center text-gray-500 font-semibold">
                  Status
                </th>
                <th className="px-3 py-3 text-center text-gray-500 font-semibold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((c, i) => (
                  <CampaignRow
                    key={c.Id}
                    campaign={c}
                    index={(currentPage - 1) * perPage + i + 1}
                    checked={selected.includes(c.Id)}
                    onToggle={() => toggleOne(c.Id)}
                    onDelete={() => deleteSingle(c.Id)}
                    onToggleStatus={() => toggleStatus(c.Id)}
                    onView={() => onViewCampaign && onViewCampaign(c)}
                    onEdit={() => onEditCampaign && onEditCampaign(c)}
                    frontendUrl={getFrontendLandingUrl(c.Id)}
                  />
                ))}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    No campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Showing{" "}
            {filtered.length === 0 ? 0 : (currentPage - 1) * perPage + 1}–
            {Math.min(currentPage * perPage, filtered.length)} of{" "}
            {filtered.length}
          </div>
          <div className="flex items-center gap-1">
            <PaginationBtn
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={14} />
            </PaginationBtn>
            {buildPageRange(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span
                  key={`dots-${i}`}
                  className="w-7 text-center text-gray-400 text-xs"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition ${
                    p === currentPage
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <PaginationBtn
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={14} />
            </PaginationBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignRow({
  campaign,
  index,
  checked,
  onToggle,
  onDelete,
  onToggleStatus,
  onView,
  onEdit,
  frontendUrl,
}) {
  return (
    <tr
      className={`border-b border-gray-50 transition ${checked ? "bg-blue-50" : "hover:bg-gray-50/60"}`}
    >
      <td className="px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="rounded accent-blue-600"
        />
      </td>
      <td className="px-3 py-2.5 text-gray-400">{index}</td>
      <td className="px-3 py-2.5">
        <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded">
          {campaign.product}
        </span>
      </td>
      <td className="px-3 py-2.5 font-semibold text-gray-800">
        {campaign.title}
      </td>
      <td className="px-3 py-2.5 text-gray-500">{campaign.template}</td>
      <td className="px-3 py-2.5 text-gray-500">{campaign.countdown}</td>
      <td className="px-3 py-2.5 text-center">
        <button
          type="button"
          onClick={onToggleStatus}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
            campaign.status ? "bg-green-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              campaign.status ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </td>
      <td className="px-3 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          <ActionBtn
            icon={<Eye size={12} />}
            color="bg-cyan-100 text-cyan-600 hover:bg-cyan-200"
            title="View"
            onClick={onView}
          />
          <ActionLink
            icon={<ExternalLink size={12} />}
            color="bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
            title="Open frontend landing page"
            href={frontendUrl}
          />
          <ActionBtn
            icon={<Edit2 size={12} />}
            color="bg-blue-100 text-blue-600 hover:bg-blue-200"
            title="Edit"
            onClick={onEdit}
          />
          <ActionBtn
            icon={<Trash2 size={12} />}
            color="bg-red-100 text-red-500 hover:bg-red-200"
            title="Delete"
            onClick={onDelete}
          />
        </div>
      </td>
    </tr>
  );
}

function ActionLink({ icon, color, title, href }) {
  return (
    <a
      href={href}
      title={title}
      target="_blank"
      rel="noreferrer"
      className={`w-6 h-6 rounded flex items-center justify-center transition ${color}`}
    >
      {icon}
    </a>
  );
}

function ActionBtn({ icon, color, title, onClick }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-6 h-6 rounded flex items-center justify-center transition ${color}`}
    >
      {icon}
    </button>
  );
}

function PaginationBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 rounded flex items-center justify-center transition ${
        disabled
          ? "bg-gray-50 text-gray-300 cursor-not-allowed"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  for (
    let p = Math.max(2, current - 1);
    p <= Math.min(total - 1, current + 1);
    p++
  )
    pages.push(p);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
