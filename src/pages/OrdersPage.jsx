import { formatInvoiceNumber } from "../utils/invoiceNumber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Eye,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Loader2,
  Ban,
  X,
  List,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Copy,
  MessageCircle,
  Printer,
  Truck,
} from "lucide-react";
import { useOrders } from "../hooks/useOrders";
import { useAuth } from "../context/AuthContext";
import { orderService } from "../services/orderService";
import { userService } from "../services/adminService";
import { orderStatusService } from "../services/websiteService";
import { ipBlockService } from "../services/websiteService";
import {
  buildStatusMaps,
  normalizeOrderStatuses,
  toOrderStatusKey,
} from "../utils/orderStatuses";
import { imageUrl } from "../utils/assetUrl";
import {
  getLogo,
  getSiteName,
  normalizeSettingData,
} from "../utils/siteBranding";

const PAGE_SIZE = 20;

const COURIER_COLORS = {
  Pathao: "bg-pink-100 text-pink-700",
  Steadfast: "bg-blue-100 text-blue-700",
  Redx: "bg-red-100 text-red-700",
  Paperfly: "bg-purple-100 text-purple-700",
  eCourier: "bg-green-100 text-green-700",
};

const ORDER_SOURCE_OPTIONS = [
  "Website",
  "Facebook",
  "Google",
  "WooCommerce",
  "Landing Page",
  "POS",
  "Manual",
  "Other",
];

const TABLE_STATUS_UPDATE_OPTIONS = [
  "pending",
  "packaging",
  "confirmed",
  "incomplete",
];
const TABLE_STATUS_UPDATE_VIEWS = ["all", ...TABLE_STATUS_UPDATE_OPTIONS];

function getApiList(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.result)) return payload.data.result;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload)) return payload;
  return [];
}

function getEmployeeName(employee) {
  const fullName = [employee?.FirstName, employee?.LastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    employee?.name ||
    employee?.Name ||
    fullName ||
    employee?.Email ||
    employee?.Phone ||
    (employee?.Id ? `Employee #${employee.Id}` : "")
  );
}

function normalizeEmployeeOptions(rows) {
  const seen = new Set();
  return getApiList(rows)
    .filter((employee) => {
      const role = String(employee?.role || "employee")
        .trim()
        .toLowerCase();
      const status = String(employee?.status || "active")
        .trim()
        .toLowerCase();
      return (
        role === "employee" && status !== "inactive" && status !== "disabled"
      );
    })
    .map((employee) => ({
      ...employee,
      Id: employee?.Id ?? employee?.id,
      name: getEmployeeName(employee),
    }))
    .filter((employee) => {
      const id = employee?.Id ?? employee?.id;
      if (!id || seen.has(String(id))) return false;
      seen.add(String(id));
      return true;
    });
}

function getAssignedEmployeeName(order) {
  return (
    order?.assignedEmployeeName ||
    getEmployeeName(order?.assignedEmployee || {})
  );
}

function getAssignedByName(order) {
  return order?.assignedByName || getEmployeeName(order?.assignedByUser || {});
}

export default function OrdersPage({
  activeStatus,
  onStatusChange,
  onCreateOrder,
  onViewOrder,
  onEditOrder,
  onPrintOrder,
  onViewCustomer,
  siteSettings,
  statusCounts = {},
  onCountsRefresh,
}) {
  const { user } = useAuth();
  const [orderStatuses, setOrderStatuses] = useState(() =>
    normalizeOrderStatuses(),
  );
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [appliedEmployeeFilter, setAppliedEmployeeFilter] = useState("all");
  const [productInfoOrder, setProductInfoOrder] = useState(null);
  const [fraudCheckOrder, setFraudCheckOrder] = useState(null);
  const [fraudCheckData, setFraudCheckData] = useState(null);
  const [fraudCheckLoading, setFraudCheckLoading] = useState(false);
  const [fraudCheckError, setFraudCheckError] = useState("");
  const [noteModal, setNoteModal] = useState(null);
  const [courierBusyId, setCourierBusyId] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [bulkCourierBusy, setBulkCourierBusy] = useState(false);
  const [barcodePrintOrders, setBarcodePrintOrders] = useState([]);
  const [invoicePrintOrders, setInvoicePrintOrders] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState("");

  const { orders, meta, loading, error, refetch } = useOrders({
    status: activeStatus,
    search: appliedSearch,
    fromDate: appliedFrom,
    toDate: appliedTo,
    assignedEmployeeId: appliedEmployeeFilter,
    page,
    limit: PAGE_SIZE,
  });

  const visibleOrderIds = useMemo(
    () => orders.map((order) => Number(order.Id)).filter(Boolean),
    [orders],
  );
  const allVisibleSelected =
    visibleOrderIds.length > 0 &&
    visibleOrderIds.every((id) => selectedOrderIds.includes(id));
  const selectedCourierOrderIds = useMemo(
    () =>
      selectedOrderIds.filter((id) =>
        canSendOrderToCourier(
          orders.find((order) => Number(order.Id) === Number(id)),
        ),
      ),
    [orders, selectedOrderIds],
  );
  const canAssignOrders = ["superadmin", "admin"].includes(
    String(user?.role || "")
      .trim()
      .toLowerCase(),
  );

  useEffect(() => {
    setSelectedOrderIds((ids) =>
      ids.filter((id) => visibleOrderIds.includes(id)),
    );
  }, [visibleOrderIds]);

  useEffect(() => {
    if (!canAssignOrders) return undefined;
    let active = true;

    async function loadAssignees() {
      try {
        const res = await orderService.getAssignees();
        if (!active) return;
        const employees = normalizeEmployeeOptions(res);
        setAssignees(employees);
        setAssignError("");
      } catch (primaryError) {
        try {
          const res = await userService.getAll({ limit: 1000 });
          if (!active) return;
          const employees = normalizeEmployeeOptions(res);
          setAssignees(employees);
          setAssignError(
            employees.length ? "" : "Employee role এর active user পাওয়া যায়নি",
          );
        } catch (fallbackError) {
          if (!active) return;
          setAssignees([]);
          setAssignError(
            fallbackError.message ||
              primaryError.message ||
              "Employee list load failed",
          );
        }
      }
    }

    loadAssignees();
    return () => {
      active = false;
    };
  }, [canAssignOrders]);

  useEffect(() => {
    if (!barcodePrintOrders.length) return undefined;

    const handleAfterPrint = () => setBarcodePrintOrders([]);
    window.addEventListener("afterprint", handleAfterPrint);
    const timer = window.setTimeout(() => window.print(), 100);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [barcodePrintOrders.length]);

  useEffect(() => {
    if (!invoicePrintOrders.length) return undefined;

    const handleAfterPrint = () => setInvoicePrintOrders([]);
    window.addEventListener("afterprint", handleAfterPrint);
    const timer = window.setTimeout(() => window.print(), 100);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [invoicePrintOrders.length]);

  function handleSearch() {
    setAppliedSearch(search);
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setAppliedEmployeeFilter(employeeFilter);
    setPage(1);
  }

  function handleEmployeeFilterChange(value) {
    setEmployeeFilter(value);
    setAppliedEmployeeFilter(value);
    setPage(1);
  }

  function handleStatusClick(key) {
    onStatusChange(key);
    setPage(1);
    setSearch("");
    setAppliedSearch("");
    setAppliedFrom("");
    setAppliedTo("");
    setEmployeeFilter("all");
    setAppliedEmployeeFilter("all");
    setFromDate("");
    setToDate("");
  }

  function handleResetFilters() {
    onStatusChange("all");
    setPage(1);
    setSearch("");
    setAppliedSearch("");
    setFromDate("");
    setToDate("");
    setAppliedFrom("");
    setAppliedTo("");
    onCountsRefresh?.();
  }

  async function handleDelete(id) {
    if (!window.confirm("এই অর্ডার মুছে ফেলবেন?")) return;
    try {
      await orderService.deleteOrder(id);
      refetch();
      onCountsRefresh?.();
    } catch (err) {
      alert(err.message || "Delete failed");
    }
  }

  async function handleBlockIp(order) {
    const ip = String(order.ipAddress || "").trim();
    if (!ip) return;
    if (!window.confirm(`${ip} IP address block করবেন?`)) return;
    try {
      await ipBlockService.create({
        ip,
        reason: `Blocked from order ${formatInvoiceNumber(order, order.Id)}`,
      });
      alert(`${ip} blocked successfully.`);
    } catch (err) {
      alert(err.message || "IP block failed");
    }
  }

  async function handleToggleFraudStatus(order) {
    const current = order.fraudGuard?.status || order.fraudStatus || "";
    const nextStatus = current === "fake" ? "safe" : "fake";
    const label = nextStatus === "fake" ? "Fake Order" : "Safe";
    if (
      !window.confirm(
        `${formatInvoiceNumber(order, order.Id)} কে ${label} mark করবেন?`,
      )
    )
      return;
    try {
      await orderService.updateOrder(order.Id, {
        fraudStatus: nextStatus,
        fraudReason:
          nextStatus === "fake"
            ? "Manually marked as fake from Fraud Guard"
            : "Manually marked as safe from Fraud Guard",
      });
      refetch();
    } catch (err) {
      alert(err.message || "Fraud status update failed");
    }
  }

  async function handleSaveOrderNote(order, noteText) {
    const note = buildOrderNoteWithAdminNote(order, noteText);
    await orderService.updateOrder(order.Id, { note });
    refetch();
  }

  async function handleReplaceOrderNotes(order, notes) {
    const note = buildOrderNoteWithAdminNotes(order, notes);
    await orderService.updateOrder(order.Id, { note });
    refetch();
  }

  async function handleSaveOrderSource(order, source) {
    const note = buildOrderNoteWithSource(order, source);
    await orderService.updateOrder(order.Id, {
      note,
      orderSource: source || "Website",
    });
    refetch();
  }

  async function handleTableStatusChange(order, status) {
    const nextStatus = toOrderStatusKey(status);
    if (!TABLE_STATUS_UPDATE_OPTIONS.includes(nextStatus)) return;
    if (nextStatus === toOrderStatusKey(order.status)) return;
    try {
      await orderService.updateOrderStatus(order.Id, nextStatus);
      await refetch();
      onCountsRefresh?.();
    } catch (err) {
      alert(err.message || "Order status update failed");
    }
  }

  async function handleSendToSteadfast(order) {
    if (
      !window.confirm(
        `${formatInvoiceNumber(order, order.Id)} Steadfast courier এ পাঠাবেন?`,
      )
    )
      return;
    setCourierBusyId(order.Id);
    try {
      await orderService.sendToSteadfast(order.Id);
      await refetch();
      onCountsRefresh?.();
      alert("Steadfast courier এ order পাঠানো হয়েছে।");
    } catch (err) {
      alert(err.message || "Steadfast courier এ পাঠানো যায়নি");
    } finally {
      setCourierBusyId(null);
    }
  }

  async function handleSendToPathao(order) {
    if (
      !window.confirm(
        `${formatInvoiceNumber(order, order.Id)} Pathao courier এ পাঠাবেন?`,
      )
    )
      return;
    setCourierBusyId(order.Id);
    try {
      await orderService.sendToPathao(order.Id);
      await refetch();
      onCountsRefresh?.();
      alert("Pathao courier এ order পাঠানো হয়েছে।");
    } catch (err) {
      alert(err.message || "Pathao courier এ পাঠানো যায়নি");
    } finally {
      setCourierBusyId(null);
    }
  }

  async function handleSyncSteadfastStatus(order) {
    setCourierBusyId(order.Id);
    try {
      await orderService.syncSteadfastStatus(order.Id);
      await refetch();
      onCountsRefresh?.();
    } catch (err) {
      alert(err.message || "Steadfast status sync failed");
    } finally {
      setCourierBusyId(null);
    }
  }

  async function handleSyncPathaoStatus(order) {
    setCourierBusyId(order.Id);
    try {
      await orderService.syncPathaoStatus(order.Id);
      await refetch();
      onCountsRefresh?.();
    } catch (err) {
      alert(err.message || "Pathao status sync failed");
    } finally {
      setCourierBusyId(null);
    }
  }

  function handleToggleOrderSelection(orderId) {
    const id = Number(orderId);
    setSelectedOrderIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }

  function handleToggleAllVisible() {
    setSelectedOrderIds((ids) => {
      if (allVisibleSelected)
        return ids.filter((id) => !visibleOrderIds.includes(id));
      return [...new Set([...ids, ...visibleOrderIds])];
    });
  }

  async function handleBulkSendToSteadfast() {
    if (!selectedCourierOrderIds.length) return;
    const confirmedIds = selectedCourierOrderIds;
    if (!confirmedIds.length) {
      alert(
        "Selected orders এর মধ্যে courier এ পাঠানোর মতো confirmed order নেই",
      );
      return;
    }
    if (
      !window.confirm(
        `${confirmedIds.length} টি confirmed order Steadfast courier এ পাঠাবেন?`,
      )
    )
      return;
    setBulkCourierBusy(true);
    try {
      const res = await orderService.bulkSendToSteadfast(confirmedIds);
      const data = res.data || {};
      const sent = data.sent?.length || 0;
      const skipped = data.skipped?.length || 0;
      setSelectedOrderIds([]);
      await refetch();
      onCountsRefresh?.();
      alert(
        `Steadfast bulk send complete. Sent: ${sent}, Skipped/Error: ${skipped}`,
      );
    } catch (err) {
      alert(err.message || "Bulk send to Steadfast failed");
    } finally {
      setBulkCourierBusy(false);
    }
  }

  async function handleBulkSendToPathao() {
    if (!selectedCourierOrderIds.length) return;
    const confirmedIds = selectedCourierOrderIds;
    if (!confirmedIds.length) {
      alert(
        "Selected orders এর মধ্যে courier এ পাঠানোর মতো confirmed order নেই",
      );
      return;
    }
    if (
      !window.confirm(
        `${confirmedIds.length} টি confirmed order Pathao courier এ পাঠাবেন?`,
      )
    )
      return;
    setBulkCourierBusy(true);
    try {
      const res = await orderService.bulkSendToPathao(confirmedIds);
      const data = res.data || {};
      const sent = data.sent?.length || 0;
      const skipped = data.skipped?.length || 0;
      setSelectedOrderIds([]);
      await refetch();
      onCountsRefresh?.();
      alert(
        `Pathao bulk send complete. Sent: ${sent}, Skipped/Error: ${skipped}`,
      );
    } catch (err) {
      alert(err.message || "Bulk send to Pathao failed");
    } finally {
      setBulkCourierBusy(false);
    }
  }

  function handlePrintSelectedBarcodes() {
    const selectedOrders = selectedOrderIds
      .map((id) => orders.find((order) => Number(order.Id) === Number(id)))
      .filter(Boolean);

    if (!selectedOrders.length) {
      alert("Barcode print করার জন্য আগে order select করুন");
      return;
    }

    setBarcodePrintOrders(selectedOrders);
  }

  function handlePrintSelectedInvoices() {
    const selectedOrders = selectedOrderIds
      .map((id) => orders.find((order) => Number(order.Id) === Number(id)))
      .filter(Boolean);

    if (!selectedOrders.length) {
      alert("Invoice print করার জন্য আগে order select করুন");
      return;
    }

    setInvoicePrintOrders(selectedOrders);
  }

  async function handleAssignSelectedOrders() {
    setAssignError("");
    if (!selectedOrderIds.length) {
      setAssignError("Assign করার জন্য আগে order select করুন");
      return;
    }
    if (!selectedEmployeeId) {
      setAssignError("Transfer To থেকে employee select করুন");
      return;
    }
    const employee = assignees.find(
      (item) => String(item.Id) === String(selectedEmployeeId),
    );
    if (
      !window.confirm(
        `${selectedOrderIds.length} টি order ${employee?.name || "selected employee"} কে assign করবেন?`,
      )
    )
      return;
    setAssignBusy(true);
    try {
      try {
        await orderService.bulkAssign(selectedOrderIds, selectedEmployeeId);
      } catch (err) {
        if (
          !/api not found|not found|cannot\s+(post|put)/i.test(
            err.message || "",
          )
        ) {
          throw err;
        }
        const assignedByName = getEmployeeName(user);
        await Promise.all(
          selectedOrderIds.map((id) =>
            orderService.updateOrder(id, {
              assignedEmployeeId: selectedEmployeeId,
              assignedEmployeeName: employee?.name || "",
              assignedById: user?.Id || user?.id || null,
              assignedByName,
              assignedAt: new Date().toISOString(),
            }),
          ),
        );
      }
      setSelectedOrderIds([]);
      await refetch();
      onCountsRefresh?.();
      setAssignError("");
    } catch (err) {
      setAssignError(err.message || "Order assign failed");
    } finally {
      setAssignBusy(false);
    }
  }

  async function openFraudCheck(order, refresh = false) {
    setFraudCheckOrder(order);
    setFraudCheckLoading(true);
    setFraudCheckError("");
    try {
      const res = await orderService.getFraudCheck(order.Id, {
        refresh: refresh ? 1 : undefined,
      });
      setFraudCheckData(res.data || null);
    } catch (err) {
      setFraudCheckError(err.message || "Fraud check failed");
      setFraudCheckData(null);
    } finally {
      setFraudCheckLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((meta?.total || 0) / PAGE_SIZE));
  const currentStatus = activeStatus || "all";
  const canShowCourierSelection = true;
  const tableColumnCount = 16;
  const statusMaps = useMemo(
    () => buildStatusMaps(orderStatuses),
    [orderStatuses],
  );
  const tabStatuses = useMemo(
    () => ["all", ...statusMaps.statuses.map((s) => s.key)],
    [statusMaps.statuses],
  );
  const sameDayDuplicateOrderIds = useMemo(
    () => getSameDayDuplicateOrderIds(orders),
    [orders],
  );

  useEffect(() => {
    let mounted = true;
    orderStatusService
      .getAll({ limit: 100 })
      .then((res) => {
        if (mounted) setOrderStatuses(normalizeOrderStatuses(res.data || []));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Status tab filter */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-1.5 flex-wrap">
        {tabStatuses.map((s) => (
          <button
            key={s}
            onClick={() => handleStatusClick(s)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition whitespace-nowrap ${
              currentStatus === s
                ? "text-white shadow"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={
              currentStatus === s
                ? {
                    backgroundColor:
                      s === "all"
                        ? "#06b6d4"
                        : orderStatuses.find((item) => item.key === s)?.color,
                  }
                : undefined
            }
          >
            {statusMaps.labels[s] || s}
            <span className="ml-1 opacity-80">({statusCounts[s] ?? 0})</span>
          </button>
        ))}
        <button
          onClick={onCreateOrder}
          className="ml-auto flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-full transition"
        >
          <Plus size={13} />
          Create Order
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Search & Filter */}
        <div className="rounded-xl bg-white p-3 shadow">
          <div className="grid items-end gap-3 xl:grid-cols-[280px_170px_190px_minmax(280px,1fr)_auto_auto]">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                Date Range
              </label>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 min-w-0 rounded-lg border border-gray-200 px-3 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9 min-w-0 rounded-lg border border-gray-200 px-3 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>

            <SearchableSelect
              label="Status"
              value={currentStatus}
              options={tabStatuses.map((s) => ({
                value: s,
                label: statusMaps.labels[s] || s,
              }))}
              onChange={handleStatusClick}
            />

            {canAssignOrders && (
              <SearchableSelect
                label="Employee"
                value={employeeFilter}
                options={[
                  { value: "all", label: "Employee: All" },
                  { value: "unassigned", label: "Not Assigned" },
                  ...assignees.map((employee) => ({
                    value: String(employee.Id),
                    label: employee.name,
                  })),
                ]}
                onChange={handleEmployeeFilterChange}
              />
            )}

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                Search
              </label>
              <input
                type="text"
                placeholder="ফোন / নাম / অর্ডার ID / IP"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <button
              onClick={handleSearch}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white transition hover:bg-blue-700"
            >
              <Search size={13} />
              Search
            </button>

            <button
              onClick={handleResetFilters}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 text-xs text-gray-600 transition hover:bg-gray-200"
              title="Reset filters"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          <div className="mt-2 text-right text-xs text-gray-500">
            Total:{" "}
            <span className="font-semibold text-gray-800">
              {meta?.total ?? 0}
            </span>{" "}
            orders
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div
            className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
            style={{ background: "linear-gradient(90deg, #111111, #3F3F3F)" }}
          >
            <span className="text-white font-semibold text-sm">
              {statusMaps.labels[currentStatus] || "All Order"} (
              {meta?.total ?? 0})
            </span>
            <div className="flex items-center gap-2">
              {canShowCourierSelection &&
                selectedCourierOrderIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleBulkSendToSteadfast}
                      disabled={bulkCourierBusy}
                      className="inline-flex items-center gap-1 rounded bg-white px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
                    >
                      {bulkCourierBusy ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Truck size={13} />
                      )}
                      Steadfast ({selectedCourierOrderIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkSendToPathao}
                      disabled={bulkCourierBusy}
                      className="inline-flex items-center gap-1 rounded bg-white px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                    >
                      {bulkCourierBusy ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Truck size={13} />
                      )}
                      Pathao ({selectedCourierOrderIds.length})
                    </button>
                  </>
                )}
              {loading && (
                <Loader2 size={16} className="text-white animate-spin" />
              )}
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 text-red-600 text-xs">
              Error: {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {canShowCourierSelection && (
                    <th className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleToggleAllVisible}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        title="Select all visible orders"
                      />
                    </th>
                  )}
                  <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    #
                  </th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Customer
                  </th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Source
                  </th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Product
                  </th>
                  <th className="text-right px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Total Bill
                  </th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Courier
                  </th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap min-w-[150px]">
                    Fraud Guard
                  </th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Note
                  </th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Summary
                  </th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Order Info
                  </th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    IP
                  </th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Employee
                  </th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Assigned By
                  </th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={tableColumnCount}
                      className="text-center py-12 text-gray-400"
                    >
                      <Loader2 size={20} className="inline animate-spin mr-2" />
                      লোড হচ্ছে...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={tableColumnCount}
                      className="text-center py-12 text-gray-400"
                    >
                      কোনো অর্ডার পাওয়া যায়নি
                    </td>
                  </tr>
                ) : (
                  orders.map((order, idx) => (
                    <OrderRow
                      key={order.Id}
                      order={order}
                      index={(page - 1) * PAGE_SIZE + idx + 1}
                      onView={() => onViewOrder && onViewOrder(order)}
                      onEdit={() => onEditOrder && onEditOrder(order)}
                      onPrintOrder={() => onPrintOrder && onPrintOrder(order)}
                      onDelete={() => handleDelete(order.Id)}
                      onBlockIp={() => handleBlockIp(order)}
                      onToggleFraudStatus={() => handleToggleFraudStatus(order)}
                      onProductInfo={() => setProductInfoOrder(order)}
                      onFraudCheck={() => openFraudCheck(order)}
                      onCustomerProfile={() => onViewCustomer?.(order)}
                      onAddNote={() => setNoteModal({ order, mode: "add" })}
                      onShowNotes={() => setNoteModal({ order, mode: "show" })}
                      onSourceChange={(source) =>
                        handleSaveOrderSource(order, source)
                      }
                      onStatusChange={(status) =>
                        handleTableStatusChange(order, status)
                      }
                      canEditStatus={TABLE_STATUS_UPDATE_VIEWS.includes(
                        currentStatus,
                      )}
                      onSendToSteadfast={() => handleSendToSteadfast(order)}
                      onSendToPathao={() => handleSendToPathao(order)}
                      onSyncSteadfastStatus={() =>
                        handleSyncSteadfastStatus(order)
                      }
                      onSyncPathaoStatus={() => handleSyncPathaoStatus(order)}
                      courierBusy={courierBusyId === order.Id}
                      selected={selectedOrderIds.includes(Number(order.Id))}
                      onSelect={() => handleToggleOrderSelection(order.Id)}
                      showCourierSelection={canShowCourierSelection}
                      isSameDayDuplicate={sameDayDuplicateOrderIds.has(
                        order.Id,
                      )}
                      statusLabels={statusMaps.labels}
                      statusClasses={statusMaps.classes}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, meta?.total || 0)}–
              {Math.min(page * PAGE_SIZE, meta?.total || 0)} of{" "}
              {meta?.total || 0}
            </div>
            <div className="flex items-center gap-1">
              <PageBtn
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                icon={<ChevronLeft size={14} />}
              />
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) {
                  p = page - 2 + i;
                  if (p > totalPages) p = totalPages - (4 - i);
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded text-xs font-medium transition ${p === page ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {p}
                  </button>
                );
              })}
              <PageBtn
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                icon={<ChevronRight size={14} />}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Action</h2>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-4">
            <button
              type="button"
              onClick={handlePrintSelectedBarcodes}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
            >
              <Printer size={14} />
              Print Barcode
            </button>
            <button
              type="button"
              onClick={handlePrintSelectedInvoices}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <Printer size={14} />
              Print Invoice
            </button>
          </div>
          {canAssignOrders && (
            <div className="border-t border-gray-100 px-4 pb-4 pt-3">
              <div className="grid max-w-3xl gap-3 md:grid-cols-[minmax(220px,1fr)_auto] md:items-end">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-700">
                    Transfer To*
                  </span>
                  <select
                    value={selectedEmployeeId}
                    onChange={(event) => {
                      setSelectedEmployeeId(event.target.value);
                      setAssignError("");
                    }}
                    className="h-9 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-teal-500"
                  >
                    <option value="">Select Employee</option>
                    {assignees.map((employee) => (
                      <option key={employee.Id} value={employee.Id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleAssignSelectedOrders}
                  disabled={assignBusy}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-teal-600 px-4 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assignBusy && <Loader2 size={13} className="animate-spin" />}
                  Transfer Selected
                </button>
              </div>
              {assignError && (
                <div className="mt-2 text-xs font-semibold text-red-500">
                  {assignError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {productInfoOrder && (
        <ProductInfoModal
          order={productInfoOrder}
          onClose={() => setProductInfoOrder(null)}
        />
      )}

      {fraudCheckOrder && (
        <FraudCheckModal
          order={fraudCheckOrder}
          data={fraudCheckData}
          loading={fraudCheckLoading}
          error={fraudCheckError}
          onRefresh={() => openFraudCheck(fraudCheckOrder, true)}
          onClose={() => {
            setFraudCheckOrder(null);
            setFraudCheckData(null);
            setFraudCheckError("");
          }}
        />
      )}

      {noteModal && (
        <OrderNoteModal
          order={noteModal.order}
          mode={noteModal.mode}
          onSave={handleSaveOrderNote}
          onReplaceNotes={handleReplaceOrderNotes}
          onClose={() => setNoteModal(null)}
        />
      )}

      {barcodePrintOrders.length > 0 && (
        <OrderBarcodePrintSheet orders={barcodePrintOrders} />
      )}

      {invoicePrintOrders.length > 0 && (
        <OrderInvoicePrintSheet
          orders={invoicePrintOrders}
          siteSettings={siteSettings}
        />
      )}
    </div>
  );
}

function parseOrderNote(note) {
  if (!note || typeof note !== "string") return null;
  try {
    return JSON.parse(note);
  } catch {
    return null;
  }
}

function OrderBarcodePrintSheet({ orders }) {
  return (
    <div className="order-barcode-print-area">
      <div className="order-barcode-print-toolbar">
        <button type="button" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <div className="order-barcode-print-sheet">
        {orders.map((order) => (
          <OrderBarcodeLabel key={order.Id} order={order} />
        ))}
      </div>

      <style>{`
        .order-barcode-print-area {
          display: none;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        .order-barcode-print-toolbar {
          padding: 12px;
          text-align: center;
        }

        .order-barcode-print-toolbar button {
          border: 1px solid #111827;
          border-radius: 4px;
          background: #ffffff;
          padding: 4px 14px;
          font-size: 12px;
          font-weight: 600;
        }

        .order-barcode-print-sheet {
          display: block;
          background: #ffffff;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        }

        .order-barcode-label {
          position: relative;
          height: 277mm;
          break-after: page;
          page-break-after: always;
          text-align: center;
        }

        .order-barcode-label:last-child {
          break-after: auto;
          page-break-after: auto;
        }

        .order-barcode-label__date {
          position: absolute;
          left: 9mm;
          top: 7mm;
          margin: 0;
          font-size: 7px;
          font-weight: 500;
        }

        .order-barcode-label__content {
          width: 82mm;
          margin: 7mm auto 0;
          min-height: 40mm;
          text-align: center;
        }

        .order-barcode-label__title {
          margin: 0;
          font-size: 8px;
          font-weight: 700;
        }

        .order-barcode-label__code {
          margin: 0.45mm 0 0;
          font-size: 8.5px;
          font-weight: 700;
        }

        .order-barcode-label__text {
          margin: 0.25mm 0 0;
          font-size: 8px;
          font-weight: 700;
          line-height: 1.05;
        }

        .order-barcode-label__barcode {
          display: block;
          width: 38mm;
          height: 11mm;
          overflow: hidden;
          margin: 2.2mm auto 0;
        }

        .order-barcode-label__barcode svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        .order-barcode-label__number {
          margin: 0.4mm 0 0;
          font-size: 7.5px;
          font-weight: 700;
        }

        @media print {
          @page {
            margin: 0;
          }

          body * {
            visibility: hidden !important;
          }

          .order-barcode-print-area,
          .order-barcode-print-area * {
            visibility: visible !important;
          }

          .order-barcode-print-area {
            display: block !important;
            position: absolute;
            inset: 0;
            background: #ffffff;
          }

          .order-barcode-print-toolbar {
            display: none !important;
          }

          .order-barcode-print-sheet {
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}

function OrderBarcodeLabel({ order }) {
  const code = formatInvoiceNumber(order, "N/A");
  const bars = buildBarcodeBars(code);
  const barcodeWidth = bars.reduce((sum, bar) => sum + bar.width, 0);
  const address = getCustomerAddressItems(order)
    .map((item) => item.value)
    .filter(Boolean)
    .join(", ");
  const printedAt = formatBarcodePrintedAt(new Date());

  return (
    <div className="order-barcode-label">
      <p className="order-barcode-label__date">{printedAt}</p>
      <div className="order-barcode-label__content">
        <p className="order-barcode-label__title">Label Print</p>
        <div className="order-barcode-label__barcode">
          <svg
            viewBox={`0 0 ${barcodeWidth} 60`}
            preserveAspectRatio="none"
            aria-label={`Barcode ${code}`}
          >
            <rect width={barcodeWidth} height="60" fill="#ffffff" />
            {
              bars.reduce(
                (items, bar, index) => {
                  const x = items.offset;
                  items.offset += bar.width;
                  if (bar.black) {
                    items.nodes.push(
                      <rect
                        key={`${x}-${index}`}
                        x={x}
                        y="0"
                        width={bar.width}
                        height="60"
                        fill="#000000"
                      />,
                    );
                  }
                  return items;
                },
                { offset: 0, nodes: [] },
              ).nodes
            }
          </svg>
        </div>
        <p className="order-barcode-label__number">
          {code.replace(/\D/g, "") || code}
        </p>
        <p className="order-barcode-label__code">
          {order.customerName || "Customer"}
        </p>
        <p className="order-barcode-label__text">{order.customerPhone || ""}</p>
        <p className="order-barcode-label__text">{address}</p>
      </div>
    </div>
  );
}

function formatBarcodePrintedAt(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year}, ${hour}:${minute}`;
}

function SearchableSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const selectedOption =
    options.find((option) => String(option.value) === String(value)) ||
    options[0];
  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) =>
      String(option.label || "")
        .toLowerCase()
        .includes(term),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function selectOption(option) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-[11px] font-semibold text-gray-500">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 text-left text-xs text-gray-600 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        <span className="min-w-0 truncate">
          {selectedOption?.label || "Select"}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder={`Search ${label.toLowerCase()}...`}
              className="h-8 w-full rounded border border-gray-200 px-2 text-xs text-gray-700 outline-none focus:border-blue-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filteredOptions.map((option) => {
              const active = String(option.value) === String(value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectOption(option)}
                  className={`block w-full border-b border-gray-50 px-3 py-2 text-left text-xs last:border-b-0 ${
                    active
                      ? "bg-blue-600 font-semibold text-white"
                      : "text-gray-700 hover:bg-blue-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-400">
                No option found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildBarcodeBars(value) {
  const source = String(value || "N/A");
  const bits = source
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");
  const framedBits = `1010${bits}0101`;
  const bars = [];
  let black = true;

  for (let i = 0; i < framedBits.length; i += 1) {
    bars.push({
      black,
      width: framedBits[i] === "1" ? 4 : 2,
    });
    black = !black;
  }

  return bars;
}

function OrderInvoicePrintSheet({ orders, siteSettings }) {
  const settings = normalizeSettingData(siteSettings);

  return (
    <div className="order-invoice-print-area">
      <div className="order-invoice-print-toolbar">
        <button type="button" onClick={() => window.print()}>
          Print
        </button>
      </div>
      {orders.map((order) => (
        <OrderInvoicePage key={order.Id} order={order} settings={settings} />
      ))}

      <style>{`
        .order-invoice-print-area {
          display: none;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        .order-invoice-print-toolbar {
          padding: 12px;
          text-align: center;
        }

        .order-invoice-print-toolbar button {
          border: 1px solid #111827;
          border-radius: 4px;
          background: #ffffff;
          padding: 4px 14px;
          font-size: 12px;
          font-weight: 600;
        }

        .bulk-invoice-page {
          width: 760px;
          min-height: 986px;
          margin: 0 auto 24px;
          background: #ffffff;
          padding: 28px 32px;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
          break-after: page;
          page-break-after: always;
          overflow: hidden;
        }

        .bulk-invoice-page:last-child {
          break-after: auto;
          page-break-after: auto;
        }

        .bulk-invoice-header {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
        }

        .bulk-invoice-logo {
          width: 128px;
          height: 128px;
          border-radius: 999px;
          object-fit: cover;
        }

        .bulk-invoice-top-right {
          text-align: right;
          font-size: 14px;
          line-height: 1.55;
        }

        .bulk-invoice-barcode {
          width: 152px;
          height: 44px;
          margin: 0 0 10px auto;
        }

        .bulk-invoice-barcode svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        .bulk-invoice-addresses {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 36px;
          margin-top: 34px;
          font-size: 14px;
          line-height: 1.55;
        }

        .bulk-invoice-addresses h2 {
          margin: 0 0 6px;
          font-size: 15px;
          font-weight: 700;
        }

        .bulk-invoice-addresses p {
          margin: 0;
        }

        .bulk-invoice-right {
          text-align: right;
        }

        .bulk-invoice-items {
          width: 100%;
          margin-top: 34px;
          border-collapse: collapse;
          font-size: 14px;
        }

        .bulk-invoice-items th {
          border-bottom: 1px solid #d1d5db;
          padding: 9px 0;
          color: #4b5563;
          font-weight: 700;
          text-align: left;
        }

        .bulk-invoice-items td {
          border-bottom: 1px solid #e5e7eb;
          padding: 10px 0;
          color: #374151;
          vertical-align: middle;
        }

        .bulk-invoice-items .center {
          text-align: center;
        }

        .bulk-invoice-items .right {
          text-align: right;
        }

        .bulk-invoice-img {
          display: flex;
          width: 40px;
          height: 40px;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid #f3f4f6;
          background: #f9fafb;
          color: #d1d5db;
          font-size: 10px;
        }

        .bulk-invoice-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .bulk-invoice-total-wrap {
          display: flex;
          justify-content: flex-end;
        }

        .bulk-invoice-totals {
          width: 350px;
          border-collapse: collapse;
          font-size: 14px;
          color: #374151;
        }

        .bulk-invoice-totals td {
          border: 1px solid #e5e7eb;
          padding: 7px 10px;
          font-weight: 700;
        }

        .bulk-invoice-payment {
          width: 100%;
          margin-top: 24px;
          border-collapse: collapse;
          font-size: 12px;
          color: #374151;
        }

        .bulk-invoice-payment td {
          border: 1px solid #e5e7eb;
          padding: 8px 10px;
          vertical-align: top;
        }

        .bulk-invoice-payment div + div {
          margin-top: 6px;
        }

        .bulk-invoice-footer {
          margin-top: 24px;
          border-top: 1px solid #e5e7eb;
          padding-top: 24px;
          text-align: center;
          font-size: 14px;
        }

        .bulk-invoice-footer strong {
          color: #4f46e5;
          font-style: italic;
        }

        .bulk-invoice-footer p {
          margin: 12px 0 0;
          color: #6b7280;
          font-style: italic;
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          body * {
            visibility: hidden !important;
          }

          .order-invoice-print-area,
          .order-invoice-print-area * {
            visibility: visible !important;
          }

          .order-invoice-print-area {
            display: block !important;
            position: absolute;
            inset: 0;
            background: #ffffff;
          }

          .order-invoice-print-toolbar {
            display: none !important;
          }

          .bulk-invoice-page {
            box-sizing: border-box;
            width: 210mm;
            height: 297mm;
            min-height: 0;
            margin: 0;
            padding: 12mm 14mm;
            overflow: hidden;
          }
        }
      `}</style>
    </div>
  );
}

function OrderInvoicePage({ order, settings }) {
  const meta = getOrderNoteMeta(order);
  const items = getInvoiceItems(order, meta);
  const subtotal =
    Number(order.subtotal ?? meta.subtotal) ||
    items.reduce((sum, item) => sum + item.total, 0);
  const shipping = Number(order.deliveryCharge ?? meta.deliveryCharge ?? 0);
  const discount = Number(meta.discount || order.discount || 0);
  const finalTotal =
    Number(order.totalBill || order.total || meta.total) ||
    Math.max(0, subtotal + shipping - discount);
  const paid = Number(
    order.advance || order.paid || meta.advance || meta.paid || 0,
  );
  const due = Math.max(0, finalTotal - paid);
  const invoiceNo = getInvoiceNumber(order);
  const orderDate = order.orderDate || order.createdAt || meta.orderDate;
  const paymentMethod = formatPaymentMethod(
    order.paymentMethod || meta.paymentMethod,
  );
  const sellerName =
    getSiteName(settings) || settings.companyName || "Holy Gift";
  const sellerPhone =
    settings.phone || settings.phoneNumber || "+8809639555111";
  const sellerEmail = settings.email || " ";
  const sellerAddress =
    settings.address || "500/3 Khilgaon Niribili Society, Dhaka Bangladesh";
  const logo = getLogo(settings) || "/homzify-logo.jpeg";
  const customerAddress =
    order.customerAddress ||
    meta.customerAddress ||
    [order.customerArea, order.customerDistrict].filter(Boolean).join(", ");
  const barcodeBars = buildInvoiceBarcodeBars(invoiceNo);
  const barcodeWidth = barcodeBars.reduce((sum, bar) => sum + bar.width, 0);

  return (
    <div className="bulk-invoice-page">
      <header className="bulk-invoice-header">
        <div>
          <img
            src={logo}
            alt={sellerName}
            className="bulk-invoice-logo"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </div>
        <div className="bulk-invoice-top-right">
          <div className="bulk-invoice-barcode">
            <svg viewBox={`0 0 ${barcodeWidth} 60`} preserveAspectRatio="none">
              <rect width={barcodeWidth} height="60" fill="#ffffff" />
              {
                barcodeBars.reduce(
                  (items, bar, index) => {
                    const x = items.offset;
                    items.offset += bar.width;
                    if (bar.black) {
                      items.nodes.push(
                        <rect
                          key={`${x}-${index}`}
                          x={x}
                          y="0"
                          width={bar.width}
                          height="60"
                          fill="#000000"
                        />,
                      );
                    }
                    return items;
                  },
                  { offset: 0, nodes: [] },
                ).nodes
              }
            </svg>
          </div>
          <div>
            ইনভয়েস আইডি : <strong>{invoiceNo}</strong>
          </div>
          <div>
            অর্ডার টাইম : <strong>{formatInvoiceDate(orderDate)}</strong>
          </div>
        </div>
      </header>

      <section className="bulk-invoice-addresses">
        <div>
          <h2>বিক্রেতা</h2>
          <p>{sellerName}</p>
          <p>{sellerEmail}</p>
          <p>{sellerPhone}</p>
          <p>{sellerAddress}</p>
        </div>
        <div className="bulk-invoice-right">
          <h2>পণ্য ডেলিভারির ঠিকানা</h2>
          <p>{order.customerName || "Customer"}</p>
          <p>{order.customerPhone || "N/A"}</p>
          <p>{customerAddress || "N/A"}</p>
        </div>
      </section>

      <table className="bulk-invoice-items">
        <thead>
          <tr>
            <th style={{ width: 96 }}>ছবি</th>
            <th>বিবরণ</th>
            <th className="center" style={{ width: 144 }}>
              পরিমাণ
            </th>
            <th className="right" style={{ width: 144 }}>
              মোট মূল্য
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="bulk-invoice-img">
                  {item.image ? (
                    <img
                      src={imageUrl(item.image)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                        event.currentTarget.parentElement.textContent = "IMG";
                      }}
                    />
                  ) : (
                    "IMG"
                  )}
                </div>
              </td>
              <td>{item.name}</td>
              <td className="center">
                {item.qty} x {invoiceMoney(item.unitPrice)}
              </td>
              <td className="right">{invoiceMoney(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="bulk-invoice-total-wrap">
        <table className="bulk-invoice-totals">
          <tbody>
            <InvoiceTotalRow
              label="পণ্যের মোট মূল্য"
              value={invoiceMoney(subtotal)}
            />
            <InvoiceTotalRow
              label="ডেলিভারি চার্জ (+)"
              value={invoiceMoney(shipping)}
            />
            <InvoiceTotalRow label="ছাড় (-)" value={invoiceMoney(discount)} />
            <InvoiceTotalRow
              label="পরিশোধ যোগ্য"
              value={invoiceMoney(finalTotal)}
            />
            <InvoiceTotalRow label="পরিশোধ" value={invoiceMoney(paid)} />
            <InvoiceTotalRow label="বাকি" value={invoiceMoney(due)} />
          </tbody>
        </table>
      </section>

      <table className="bulk-invoice-payment">
        <tbody>
          <tr>
            <InvoiceInfoCell
              label="Transaction Date"
              value={formatInvoiceDate(orderDate)}
            />
            <InvoiceInfoCell label="Payment Gateway" value={paymentMethod} />
            <InvoiceInfoCell
              label="Transaction ID"
              value={order.transactionId || meta.transactionId || ""}
            />
            <InvoiceInfoCell
              label="Account Number"
              value={order.accountNumber || meta.accountNumber || ""}
            />
            <InvoiceInfoCell label="Amount" value={paid || 0} />
          </tr>
        </tbody>
      </table>

      <footer className="bulk-invoice-footer">
        <strong>Terms & Conditions</strong>
        <p>
          * This is a computer generated invoice, does not require any
          signature.
        </p>
      </footer>
    </div>
  );
}

function InvoiceTotalRow({ label, value }) {
  return (
    <tr>
      <td>{label}</td>
      <td style={{ width: 128 }}>{value}</td>
    </tr>
  );
}

function InvoiceInfoCell({ label, value }) {
  return (
    <td>
      <div>{label}</div>
      <div>{value || ""}</div>
    </td>
  );
}

function getInvoiceNumber(order) {
  return formatInvoiceNumber(order);
}

function invoiceMoney(value) {
  return `${Number(value || 0).toLocaleString()}৳`;
}

function formatInvoiceDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function getInvoiceItems(order, meta) {
  const source = Array.isArray(order.items)
    ? order.items
    : Array.isArray(meta.items)
      ? meta.items
      : [];

  if (source.length) {
    return source.map((item, index) => {
      const qty = Number(item.qty || item.quantity || 1) || 1;
      const unitPrice = Number(item.price || item.salePrice || 0);
      const total = Number(item.total || item.lineTotal || unitPrice * qty);
      return {
        id: item.id || item.productId || index,
        name: `${item.name || item.productName || "Product"}${item.variant ? ` (${item.variant})` : ""}`,
        qty,
        unitPrice: unitPrice || Math.round(total / qty),
        total,
        image: getInvoiceItemImage(item),
      };
    });
  }

  const qty = Number(order.quantity || 1) || 1;
  const total = Number(order.totalBill || order.total || 0);
  return [
    {
      id: order.Id || "single",
      name: order.productName || "Product",
      qty,
      unitPrice: Math.round(total / qty),
      total,
      image: order.productImage || "",
    },
  ];
}

function getInvoiceItemImage(item) {
  if (item.image || item.productImage) return item.image || item.productImage;
  if (Array.isArray(item.images) && item.images[0]) return item.images[0];
  if (typeof item.images === "string") {
    try {
      const parsed = JSON.parse(item.images);
      if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    } catch {
      return item.images;
    }
  }
  return "";
}

function buildInvoiceBarcodeBars(value) {
  const text = String(value || "000000");
  const bits = text
    .split("")
    .map((char, index) => {
      const code = char.charCodeAt(0) + index * 13;
      return code.toString(2).padStart(8, "0");
    })
    .join("");
  const framedBits = `101${bits}101`;
  const bars = [];
  let black = true;

  for (let i = 0; i < framedBits.length; i += 1) {
    bars.push({
      black,
      width: framedBits[i] === "1" ? 3 : 1,
    });
    black = !black;
  }

  return bars;
}

function getOrderNoteMeta(order) {
  const parsed = parseOrderNote(order.note);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    return parsed;
  return {};
}

function getSteadfastInfo(order) {
  const meta = getOrderNoteMeta(order);
  return meta.courierIntegration?.steadfast || {};
}

function getPathaoInfo(order) {
  const meta = getOrderNoteMeta(order);
  return meta.courierIntegration?.pathao || {};
}

function canSendOrderToCourier(order) {
  const steadfastInfo = getSteadfastInfo(order);
  const pathaoInfo = getPathaoInfo(order);
  return (
    toOrderStatusKey(order?.status) === "confirmed" &&
    !steadfastInfo.trackingCode &&
    !steadfastInfo.consignmentId &&
    !pathaoInfo.trackingCode &&
    !pathaoInfo.consignmentId
  );
}

function getOrderAdminNotes(order) {
  const meta = getOrderNoteMeta(order);
  const notes = Array.isArray(meta.adminNotes) ? meta.adminNotes : [];
  return notes
    .map((item) => {
      if (typeof item === "string") return { text: item, createdAt: null };
      return {
        text: String(item?.text || "").trim(),
        createdAt: item?.createdAt || null,
      };
    })
    .filter((item) => item.text);
}

function buildOrderNoteWithAdminNote(order, noteText) {
  const text = String(noteText || "").trim();
  return buildOrderNoteWithAdminNotes(order, [
    ...getOrderAdminNotes(order),
    {
      text,
      createdAt: new Date().toISOString(),
    },
  ]);
}

function buildOrderNoteWithAdminNotes(order, adminNotes) {
  const existingMeta = getOrderNoteMeta(order);
  const meta = {
    ...existingMeta,
    __frontendOrder: existingMeta.__frontendOrder ?? true,
    adminNotes: adminNotes
      .map((item) => ({
        text: String(item?.text || "").trim(),
        createdAt: item?.createdAt || new Date().toISOString(),
      }))
      .filter((item) => item.text),
  };

  if (!existingMeta.adminNotes && order.note && !parseOrderNote(order.note)) {
    meta.legacyNote = order.note;
  }

  return JSON.stringify(meta);
}

function buildOrderNoteWithSource(order, source) {
  const existingMeta = getOrderNoteMeta(order);
  const meta = {
    ...existingMeta,
    __frontendOrder: existingMeta.__frontendOrder ?? true,
    source: source || "Website",
  };

  if (!existingMeta.adminNotes && order.note && !parseOrderNote(order.note)) {
    meta.legacyNote = order.note;
  }

  return JSON.stringify(meta);
}

function getOrderSource(order) {
  const meta = getOrderNoteMeta(order);
  const source = String(
    order.source ||
      order.orderSource ||
      order.platform ||
      meta.source ||
      meta.orderSource ||
      meta.platform ||
      "",
  ).trim();
  if (source) return source;
  if (meta.landingPageId || meta.landingPage || meta.campaignId)
    return "Landing Page";
  return "Website";
}

function formatNoteTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getItemImage(item) {
  if (item.image) return item.image;
  if (Array.isArray(item.images) && item.images[0]) return item.images[0];
  if (typeof item.images === "string") {
    try {
      const parsed = JSON.parse(item.images);
      if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    } catch {
      return item.images;
    }
  }
  return "";
}

async function copyToClipboard(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* Fallback below */
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

function getWhatsappUrl(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits || digits.length < 8) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `880${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith("1"))
    digits = `880${digits}`;
  return `https://wa.me/${digits}`;
}

function getPhoneCallUrl(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits || digits.length < 8) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `880${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith("1"))
    digits = `880${digits}`;
  return `tel:+${digits}`;
}

function getCustomerAddressItems(order) {
  const values = [
    { value: order.customerAddress, className: "bg-slate-100 text-slate-600" },
    { value: order.customerArea, className: "bg-blue-100 text-blue-600" },
    {
      value: order.customerDistrict,
      className: "bg-purple-100 text-purple-600",
    },
  ];
  const seen = new Set();
  return values
    .map((item) => ({ ...item, value: String(item.value || "").trim() }))
    .filter((item) => {
      if (!item.value || seen.has(item.value.toLowerCase())) return false;
      seen.add(item.value.toLowerCase());
      return true;
    });
}

function CopyButton({ value, title = "Copy", size = 11, className = "" }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(event) {
    event.preventDefault();
    event.stopPropagation();
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`relative inline-flex items-center justify-center rounded transition ${className}`}
      title={copied ? "Copied" : title}
    >
      {copied ? <CheckCircle2 size={size} /> : <Copy size={size} />}
      {copied && (
        <span className="absolute -top-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
          Copied
        </span>
      )}
    </button>
  );
}

function getLocalDateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getOrderCustomerKey(order) {
  const phone = String(order.customerPhone || "").replace(/\D/g, "");
  if (phone) return `phone:${phone}`;
  const name = String(order.customerName || "")
    .trim()
    .toLowerCase();
  return name ? `name:${name}` : "";
}

function getSameDayDuplicateOrderIds(orders = []) {
  const groups = new Map();
  orders.forEach((order) => {
    const customerKey = getOrderCustomerKey(order);
    const dateKey = getLocalDateKey(order.orderDate || order.createdAt);
    if (!customerKey || !dateKey) return;
    const key = `${customerKey}:${dateKey}`;
    const ids = groups.get(key) || [];
    ids.push(order.Id);
    groups.set(key, ids);
  });

  const duplicateIds = new Set();
  groups.forEach((ids) => {
    if (ids.length <= 1) return;
    ids.forEach((id) => duplicateIds.add(id));
  });
  return duplicateIds;
}

function getOrderProductItems(order) {
  const note = parseOrderNote(order.note);
  const noteItems = Array.isArray(note?.items) ? note.items : [];
  if (noteItems.length) {
    return noteItems.map((item, index) => {
      const qty = Number(item.qty || item.quantity || 1) || 1;
      return {
        id: item.id || item.productId || `${order.Id}-${index}`,
        name: item.name || item.productName || "Product",
        qty,
        price: Number(item.price || item.salePrice || item.total || 0),
        image: getItemImage(item),
      };
    });
  }

  const qty = Number(order.quantity || 1) || 1;
  return [
    {
      id: order.Id,
      name: order.productName || "Product",
      qty,
      price: Number(order.totalBill || 0),
      image: order.productImage || "",
    },
  ];
}

function formatPaymentMethod(value) {
  const normalized = String(value || "cod").trim();
  if (!normalized) return "Cash On Delivery";
  const key = normalized.toLowerCase().replace(/[\s_-]+/g, "_");
  const labels = {
    cod: "Cash On Delivery",
    cash_on_delivery: "Cash On Delivery",
    bkash: "Bkash",
    nagad: "Nagad",
    rocket: "Rocket",
    sslcommerz: "SSLCommerz",
    card: "Card",
    bank_transfer: "Bank Transfer",
  };
  return (
    labels[key] ||
    normalized
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function getOrderPaymentMethod(order) {
  const note = parseOrderNote(order.note);
  return formatPaymentMethod(order.paymentMethod || note?.paymentMethod);
}

function getOrderAmountSummary(order) {
  const meta = getOrderNoteMeta(order);
  const total = Number(order.totalBill || order.total || meta.total || 0);
  const less = Number(
    order.discount || order.less || meta.discount || meta.less || 0,
  );
  const paid = Number(
    order.advance || order.paid || meta.advance || meta.paid || 0,
  );
  const due = Math.max(0, total - less - paid);
  return { total, less, paid, due };
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function OrderNoteModal({ order, mode, onSave, onReplaceNotes, onClose }) {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState(() => getOrderAdminNotes(order));
  const [editIndex, setEditIndex] = useState(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isAddMode = mode === "add";

  async function handleSubmit(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value) {
      setError("Note লিখুন");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(order, value);
      onClose();
    } catch (err) {
      setError(err.message || "Note save failed");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(note, index) {
    setEditIndex(index);
    setEditText(note.text);
    setError("");
  }

  function cancelEdit() {
    setEditIndex(null);
    setEditText("");
    setError("");
  }

  async function saveEdit(index) {
    const value = editText.trim();
    if (!value) {
      setError("Note খালি রাখা যাবে না");
      return;
    }
    const nextNotes = notes.map((note, noteIndex) =>
      noteIndex === index ? { ...note, text: value } : note,
    );
    setSaving(true);
    setError("");
    try {
      await onReplaceNotes(order, nextNotes);
      setNotes(nextNotes);
      cancelEdit();
    } catch (err) {
      setError(err.message || "Note update failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(index) {
    if (!window.confirm("এই note delete করবেন?")) return;
    const nextNotes = notes.filter((_, noteIndex) => noteIndex !== index);
    setSaving(true);
    setError("");
    try {
      await onReplaceNotes(order, nextNotes);
      setNotes(nextNotes);
      if (editIndex === index) cancelEdit();
      else if (editIndex > index) setEditIndex(editIndex - 1);
    } catch (err) {
      setError(err.message || "Note delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              {isAddMode ? "Add Note" : "Order Notes"}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {formatInvoiceNumber(order)} · {order.customerName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-gray-500 transition hover:bg-gray-200"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-4">
          {isAddMode && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={4}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Order note লিখুন..."
                autoFocus
              />
              {error && (
                <div className="text-xs font-medium text-red-500">{error}</div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Save Note
                </button>
              </div>
            </form>
          )}

          {!isAddMode && (
            <div className="space-y-2">
              {error && (
                <div className="text-xs font-medium text-red-500">{error}</div>
              )}
              {notes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-xs text-gray-400">
                  No notes added yet.
                </div>
              ) : (
                notes.map((note, index) => (
                  <div
                    key={`${note.createdAt || "note"}-${index}`}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {editIndex === index ? (
                        <div className="flex-1 space-y-2">
                          <textarea
                            value={editText}
                            onChange={(event) =>
                              setEditText(event.target.value)
                            }
                            rows={3}
                            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={saving}
                              className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEdit(index)}
                              disabled={saving}
                              className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                            >
                              {saving && (
                                <Loader2 size={12} className="animate-spin" />
                              )}
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="flex-1 whitespace-pre-wrap text-sm leading-5 text-gray-700">
                          {note.text}
                        </p>
                      )}
                      <div className="flex shrink-0 items-center gap-1">
                        {editIndex !== index && (
                          <>
                            <CopyButton
                              value={note.text}
                              title="Copy note"
                              className="h-6 w-6 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            />
                            <button
                              type="button"
                              onClick={() => startEdit(note, index)}
                              disabled={saving}
                              className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-blue-600 transition hover:bg-blue-100 disabled:opacity-60"
                              title="Edit note"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNote(index)}
                              disabled={saving}
                              className="flex h-6 w-6 items-center justify-center rounded bg-red-50 text-red-500 transition hover:bg-red-100 disabled:opacity-60"
                              title="Delete note"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {note.createdAt && (
                      <div className="mt-1 text-[10px] font-medium text-gray-400">
                        {formatNoteTime(note.createdAt)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductInfoModal({ order, onClose }) {
  const items = getOrderProductItems(order);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/45 px-4 pt-7"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[500px] overflow-hidden rounded bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">
            Product Information
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-x-auto px-4 py-3">
          <table className="w-full min-w-[460px] text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-500">
                  Image
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-500">
                  Name
                </th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-500">
                  Qty
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-500">
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-3 py-3">
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded border border-gray-100 bg-gray-50 text-[9px] text-gray-300">
                      {item.image ? (
                        <img
                          src={imageUrl(item.image)}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                            event.currentTarget.parentElement.textContent =
                              "IMG";
                          }}
                        />
                      ) : (
                        "IMG"
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    <div className="max-w-[210px] leading-5">{item.name}</div>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-600">
                    {item.qty}
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    ৳ {Number(item.price || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function riskBadgeClass(riskLevel) {
  if (riskLevel === "low") return "bg-emerald-100 text-emerald-700";
  if (riskLevel === "medium") return "bg-amber-100 text-amber-700";
  if (riskLevel === "high") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function successBarClass(successRate) {
  if (successRate >= 80) return "bg-emerald-500";
  if (successRate >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function FraudCheckModal({ order, data, loading, error, onRefresh, onClose }) {
  const stats = data?.courierStats || [];
  const totals = data?.totals || {};
  const ipInfo = data?.ipInfo || {};
  const hasMap = ipInfo.latitude != null && ipInfo.longitude != null;
  const mapUrl = hasMap
    ? `https://maps.google.com/maps?q=${encodeURIComponent(`${ipInfo.latitude},${ipInfo.longitude}`)}&z=13&output=embed`
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[780px] overflow-hidden rounded bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              Parcel Result For {order.customerPhone || "Unknown"}
            </h2>
            {data?.checkedAt && (
              <div className="mt-0.5 text-[10px] text-gray-400">
                Checked: {new Date(data.checkedAt).toLocaleString()}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex h-7 items-center gap-1 rounded bg-indigo-50 px-2 text-[11px] font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-4">
          {loading && !data ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">
              <Loader2 size={18} className="mr-2 animate-spin" />
              Checking fraud data...
            </div>
          ) : error ? (
            <div className="rounded border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">
              {error}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${riskBadgeClass(data?.riskLevel)}`}
                >
                  Risk: {data?.riskLevel || "unknown"}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  Success: {data?.successRate ?? 0}%
                </span>
              </div>

              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="w-full min-w-[760px] text-xs">
                  <thead>
                    <tr className="bg-indigo-600 text-white">
                      <th className="px-3 py-3 text-left font-semibold">
                        Courier
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Total Parcel
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Delivered
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Return
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        Success
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((row) => (
                      <tr
                        key={row.courier}
                        className="border-b border-gray-200 last:border-b-0"
                      >
                        <td className="px-3 py-3 text-gray-600">
                          {row.courier}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {row.totalParcel}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {row.delivered}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {row.return}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {row.success}%
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold text-gray-700">
                      <td className="px-3 py-3">Total</td>
                      <td className="px-3 py-3">{totals.totalParcel || 0}</td>
                      <td className="px-3 py-3">{totals.delivered || 0}</td>
                      <td className="px-3 py-3">{totals.return || 0}</td>
                      <td className="px-3 py-3">{totals.successRate || 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <section className="overflow-hidden rounded border border-gray-200">
                <div className="flex items-center justify-between bg-gray-100 px-4 py-3">
                  <h3 className="text-sm font-bold text-gray-700">
                    IP Based Location
                  </h3>
                  <span className="text-[11px] text-gray-400">
                    {ipInfo.note || "Approximate ISP/Tower location"}
                  </span>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.1fr]">
                  <table className="w-full text-xs">
                    <tbody>
                      {[
                        ["Customer IP", ipInfo.ip || order.ipAddress || "—"],
                        ["Country", ipInfo.country || "—"],
                        ["Division / Region", ipInfo.region || "—"],
                        ["City", ipInfo.city || "—"],
                        ["Latitude", ipInfo.latitude ?? "—"],
                        ["Longitude", ipInfo.longitude ?? "—"],
                      ].map(([label, value]) => (
                        <tr key={label} className="border border-gray-200">
                          <td className="w-36 px-3 py-2 font-semibold text-gray-600">
                            {label}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="min-h-[230px] overflow-hidden rounded border border-gray-200 bg-gray-50">
                    {hasMap ? (
                      <iframe
                        title="Approximate IP location"
                        src={mapUrl}
                        className="h-[260px] w-full border-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full min-h-[230px] items-center justify-center px-4 text-center text-xs text-gray-400">
                        Map unavailable for this IP address.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderRow({
  order,
  index,
  onView,
  onEdit,
  onPrintOrder,
  onDelete,
  onBlockIp,
  onToggleFraudStatus,
  onProductInfo,
  onFraudCheck,
  onCustomerProfile,
  onAddNote,
  onShowNotes,
  onSourceChange,
  onStatusChange,
  canEditStatus,
  onSendToSteadfast,
  onSendToPathao,
  onSyncSteadfastStatus,
  onSyncPathaoStatus,
  courierBusy,
  selected,
  onSelect,
  showCourierSelection,
  isSameDayDuplicate,
  statusLabels,
  statusClasses,
}) {
  const statusKey = toOrderStatusKey(order.status);
  const statusColor = statusClasses[statusKey] || "bg-gray-400 text-white";
  const statusLabel = statusLabels[statusKey] || order.status;
  const canUseTableStatusSelect =
    canEditStatus && TABLE_STATUS_UPDATE_OPTIONS.includes(statusKey);
  const paymentMethod = getOrderPaymentMethod(order);
  const repeatLabel = isSameDayDuplicate
    ? "Duplicate"
    : order.isRepeat
      ? "Repeat"
      : "New";
  const repeatButtonClass = isSameDayDuplicate
    ? "border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white"
    : "border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white";
  const courierColor =
    COURIER_COLORS[order.courier] || "bg-gray-100 text-gray-700";
  const whatsappUrl = getWhatsappUrl(order.customerPhone);
  const phoneCallUrl = getPhoneCallUrl(order.customerPhone);
  const addressItems = getCustomerAddressItems(order);
  const noteCount = getOrderAdminNotes(order).length;
  const amountSummary = getOrderAmountSummary(order);
  const orderSource = getOrderSource(order);
  const assignedEmployeeName = getAssignedEmployeeName(order);
  const assignedByName = getAssignedByName(order);
  const steadfastInfo = getSteadfastInfo(order);
  const pathaoInfo = getPathaoInfo(order);
  const canSendCourier = canSendOrderToCourier(order);
  const dateStr = order.orderDate
    ? new Date(order.orderDate).toLocaleDateString("en-GB")
    : order.createdAt
      ? new Date(order.createdAt).toLocaleDateString("en-GB")
      : "—";
  const timeStr = order.createdAt
    ? new Date(order.createdAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <tr className="border-b border-gray-50 hover:bg-blue-50/30 transition">
      {showCourierSelection && (
        <td className="px-3 py-2.5 text-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            title={`Select ${formatInvoiceNumber(order, order.Id)}`}
          />
        </td>
      )}
      <td className="px-3 py-2.5 text-gray-400 font-medium">{index}.</td>

      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <div className="font-semibold text-gray-800 text-xs">
            {order.customerName}
          </div>
          {order.customerName && (
            <CopyButton
              value={order.customerName}
              title="Copy customer name"
              className="h-5 w-5 bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          {phoneCallUrl ? (
            <a
              href={phoneCallUrl}
              className="text-xs text-gray-500 transition hover:text-blue-600 hover:underline"
              title="Call phone number"
            >
              {order.customerPhone}
            </a>
          ) : (
            <span className="text-xs text-gray-500">{order.customerPhone}</span>
          )}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-emerald-100 text-emerald-600 transition hover:bg-emerald-200"
              title="Open WhatsApp"
            >
              <MessageCircle size={13} />
            </a>
          )}
          {order.customerPhone && (
            <CopyButton
              value={order.customerPhone}
              title="Copy phone number"
              className="h-5 w-5 bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            />
          )}
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {addressItems.map((item) => (
            <span
              key={item.value}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${item.className}`}
            >
              <span>{item.value}</span>
              <CopyButton
                value={item.value}
                title="Copy address"
                size={9}
                className="h-4 w-4 hover:bg-white/70"
              />
            </span>
          ))}
        </div>
      </td>

      <td className="px-3 py-2.5">
        <select
          value={
            ORDER_SOURCE_OPTIONS.includes(orderSource) ? orderSource : "Other"
          }
          onChange={(event) => onSourceChange(event.target.value)}
          className="w-[110px] rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          title={`Source: ${orderSource}`}
        >
          {ORDER_SOURCE_OPTIONS.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
        {!ORDER_SOURCE_OPTIONS.includes(orderSource) && (
          <div className="mt-1 max-w-[110px] truncate text-[10px] font-medium text-gray-400">
            {orderSource}
          </div>
        )}
      </td>

      <td className="px-3 py-2.5">
        <div className="flex w-16 flex-col items-center gap-1.5">
          <div className="w-9 h-9 bg-gray-100 rounded-full border border-gray-200 flex items-center justify-center text-gray-300 text-[9px] flex-shrink-0 overflow-hidden">
            {order.productImage ? (
              <img
                src={imageUrl(order.productImage)}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.parentElement.textContent = "IMG";
                }}
              />
            ) : (
              "IMG"
            )}
          </div>
          <button
            type="button"
            onClick={onProductInfo}
            className="rounded bg-cyan-500 px-1.5 py-1 text-xs text-white transition hover:bg-cyan-600"
          >
            See More
          </button>
        </div>
      </td>

      <td className="px-3 py-2.5 text-right">
        <div className="font-bold text-gray-800">
          ৳ {Number(order.totalBill).toLocaleString()}
        </div>
        <div className="mt-1 text-[10px] font-medium text-gray-500">
          Method: {paymentMethod}
        </div>
        {Number(order.advance) > 0 && (
          <div className="text-gray-400 text-[10px] mt-0.5">
            Advance: ৳{Number(order.advance).toLocaleString()}
          </div>
        )}
      </td>

      <td className="px-3 py-2.5 text-center">
        <div className="flex flex-col items-center gap-1">
          {order.courier ? (
            <span
              className={`px-2 py-1 rounded-full text-[10px] font-semibold ${courierColor}`}
            >
              {order.courier}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
          {steadfastInfo.trackingCode && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700">
              {steadfastInfo.trackingCode}
            </span>
          )}
        </div>
      </td>

      <td className="px-3 py-2.5 text-center">
        {canUseTableStatusSelect ? (
          <select
            value={statusKey}
            onChange={(event) => onStatusChange(event.target.value)}
            className={`rounded-full border-0 px-2.5 py-1 text-[10px] font-semibold outline-none ring-1 ring-transparent transition focus:ring-blue-200 ${statusColor}`}
            title="Update order status"
          >
            {TABLE_STATUS_UPDATE_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status] || status}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${statusColor}`}
          >
            {statusLabel}
          </span>
        )}
        {order.status === "in_courier" && (
          <div className="text-[10px] text-indigo-500 mt-0.5">In Transit</div>
        )}
      </td>

      <td className="px-3 py-2.5 text-center">
        <FraudGuard order={order} onClick={onFraudCheck} />
      </td>

      <td className="px-3 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={onAddNote}
            className="inline-flex h-7 w-7 items-center justify-center rounded bg-emerald-100 text-emerald-600 transition hover:bg-emerald-200"
            title="Add note"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            onClick={onShowNotes}
            className="relative inline-flex h-7 w-7 items-center justify-center rounded bg-indigo-100 text-indigo-600 transition hover:bg-indigo-200"
            title="Show notes"
          >
            <List size={13} />
            {noteCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-indigo-600 px-1 text-[9px] font-bold leading-4 text-white">
                {noteCount}
              </span>
            )}
          </button>
        </div>
      </td>

      <td className="px-3 py-2.5">
        <div className="space-y-0.5 whitespace-nowrap text-[11px] font-semibold leading-5">
          <div className="text-cyan-600">
            Total: {formatAmount(amountSummary.total)}
          </div>
          <div className="text-red-500">
            Less: {formatAmount(amountSummary.less)}
          </div>
          <div className="text-emerald-600">
            Paid: {formatAmount(amountSummary.paid)}
          </div>
          <div className="text-orange-500">
            Due: {formatAmount(amountSummary.due)}
          </div>
        </div>
      </td>

      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={onEdit}
          className="font-semibold text-blue-700 underline underline-offset-2 transition hover:text-blue-900"
          title="Open order details"
        >
          {formatInvoiceNumber(order)}
        </button>
        <div className="text-gray-400 text-[10px] mt-0.5">{dateStr}</div>
        <div className="text-gray-400 text-[10px]">{timeStr}</div>
        <button
          type="button"
          onClick={onCustomerProfile}
          className={`mt-1 inline-flex rounded border px-2 py-0.5 text-xs font-medium transition ${repeatButtonClass}`}
          title="View customer profile"
        >
          {repeatLabel}
        </button>
      </td>

      <td className="px-3 py-2.5">
        {order.ipAddress ? (
          <div className="flex items-center gap-1.5">
            <div
              className="flex max-w-[170px] items-center gap-1 rounded bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700"
              title={order.ipAddress}
            >
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                {order.ipAddress}
              </span>
              <CopyButton
                value={order.ipAddress}
                title={`Copy IP: ${order.ipAddress}`}
                size={10}
                className="h-4 w-4 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              />
            </div>
            <button
              type="button"
              onClick={onBlockIp}
              className="flex h-7 w-7 items-center justify-center rounded bg-red-100 text-red-600 transition hover:bg-red-200"
              title={`Block IP: ${order.ipAddress}`}
            >
              <Ban size={13} />
            </button>
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      <td className="px-3 py-2.5">
        {assignedEmployeeName ? (
          <div className="text-xs font-semibold text-gray-700">
            {assignedEmployeeName}
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>

      <td className="px-3 py-2.5">
        {assignedByName ? (
          <div>
            <div className="text-xs font-semibold text-gray-700">
              {assignedByName}
            </div>
            {order.assignedAt && (
              <div className="mt-0.5 text-[10px] text-gray-400">
                {new Date(order.assignedAt).toLocaleDateString("en-GB")}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>

      <td className="px-3 py-2.5 text-center">
        <div className="flex flex-wrap items-center justify-center gap-1">
          <ActionBtn
            icon={<Eye size={12} />}
            color="bg-cyan-100 text-cyan-600 hover:bg-cyan-200"
            title="View"
            onClick={onView}
          />
          <ActionBtn
            icon={<Printer size={12} />}
            color="bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
            title="Print Order"
            onClick={onPrintOrder}
          />
          <ActionBtn
            icon={<Trash2 size={12} />}
            color="bg-red-100 text-red-500 hover:bg-red-200"
            title="Delete"
            onClick={onDelete}
          />
          <ActionBtn
            icon={<ShieldAlert size={12} />}
            color={
              order.fraudGuard?.status === "fake"
                ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            }
            title={
              order.fraudGuard?.status === "fake"
                ? "Mark as Safe"
                : "Mark as Fake"
            }
            onClick={onToggleFraudStatus}
          />
          {(steadfastInfo.trackingCode ||
            steadfastInfo.consignmentId ||
            canSendCourier) && (
            <ActionBtn
              icon={
                courierBusy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Truck size={12} />
                )
              }
              color={
                steadfastInfo.trackingCode || steadfastInfo.consignmentId
                  ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                  : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
              }
              title={
                steadfastInfo.trackingCode || steadfastInfo.consignmentId
                  ? "Sync Steadfast status"
                  : "Send to Steadfast"
              }
              onClick={
                steadfastInfo.trackingCode || steadfastInfo.consignmentId
                  ? onSyncSteadfastStatus
                  : onSendToSteadfast
              }
              disabled={courierBusy}
            />
          )}
          {canSendCourier && (
            <ActionBtn
              icon={
                courierBusy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Truck size={12} />
                )
              }
              color="bg-sky-100 text-sky-700 hover:bg-sky-200"
              title="Send to Pathao"
              onClick={onSendToPathao}
              disabled={courierBusy}
            />
          )}
          {(pathaoInfo.trackingCode || pathaoInfo.consignmentId) && (
            <ActionBtn
              icon={
                courierBusy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Truck size={12} />
                )
              }
              color="bg-sky-100 text-sky-700 hover:bg-sky-200"
              title="Sync Pathao status"
              onClick={onSyncPathaoStatus}
              disabled={courierBusy}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

function numberFrom(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
}

function FraudGuard({ order, onClick }) {
  const guard = order.fraudGuard || {};
  const guardStyles = {
    fake: "bg-red-100 text-red-700 border-red-200",
    high_risk: "bg-amber-100 text-amber-700 border-amber-200",
    safe: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  const guardClass = guardStyles[guard.status] || guardStyles.safe;
  const guardLabel = guard.label || "Safe";
  const guardReason = guard.reason || "No previous risk found";
  const total = numberFrom(
    order.fraudTotal,
    order.totalParcel,
    order.totalParcels,
    order.parcelTotal,
    order.courierTotal,
    order.fraudCheck?.total,
    order.fraudCheck?.totalParcel,
  );
  const delivered = numberFrom(
    order.fraudDelivered,
    order.deliveredParcel,
    order.deliveredParcels,
    order.courierDelivered,
    order.fraudCheck?.delivered,
  );
  const returned = numberFrom(
    order.fraudReturned,
    order.returnParcel,
    order.returnedParcel,
    order.returnedParcels,
    order.courierReturned,
    order.fraudCheck?.return,
    order.fraudCheck?.returned,
  );
  const explicitSuccess = Number(
    order.fraudSuccessRate ??
      order.successRate ??
      order.fraudCheck?.successRate,
  );
  const successRate = Number.isFinite(explicitSuccess)
    ? explicitSuccess
    : total > 0
      ? Math.round((delivered / total) * 100)
      : 100;
  const score = numberFrom(order.fraudScore, order.fraudCheck?.score, 1);
  const isClean = returned === 0 && (total > 0 || score <= 1);
  const barColor = isClean ? "bg-emerald-500" : "bg-rose-500";
  const showCounts = total > 0 || delivered > 0 || returned > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto flex w-[120px] flex-col items-center gap-2 rounded px-1.5 py-1.5 transition hover:bg-gray-100"
      title="View fraud check"
    >
      <span
        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${guardClass}`}
        title={guardReason}
      >
        {guardLabel}
      </span>
      <span
        className={`relative h-3 w-full overflow-hidden rounded-sm ${barColor}`}
      >
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold leading-none text-white">
          {Math.max(0, Math.min(100, Math.round(successRate)))}%
        </span>
      </span>
      <span className="flex items-center justify-center gap-4 text-[11px] font-semibold leading-none">
        <span className="inline-flex items-center gap-0.5 text-cyan-500">
          <List size={14} strokeWidth={2.6} />
          {showCounts && <span>{total}</span>}
        </span>
        <span className="inline-flex items-center gap-0.5 text-emerald-500">
          <CheckCircle2
            size={14}
            fill="currentColor"
            stroke="white"
            className="text-emerald-500"
          />
          {showCounts && <span>{delivered}</span>}
        </span>
        <span className="inline-flex items-center gap-0.5 text-rose-500">
          <XCircle
            size={14}
            fill="currentColor"
            stroke="white"
            className="text-rose-500"
          />
          {showCounts && <span>{returned}</span>}
        </span>
      </span>
    </button>
  );
}

function ActionBtn({ icon, color, title, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-6 h-6 rounded flex items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-60 ${color}`}
    >
      {icon}
    </button>
  );
}

function PageBtn({ onClick, disabled, icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 rounded flex items-center justify-center transition ${disabled ? "bg-gray-50 text-gray-300 cursor-not-allowed" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
    >
      {icon}
    </button>
  );
}
