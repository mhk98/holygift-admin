import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Minus,
  Plus,
  X,
  ShoppingCart,
  LayoutDashboard,
  ShoppingBag,
  Trash2,
  Printer,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  Check,
} from "lucide-react";
import {
  useCategories,
  useChildcategories,
  useProducts,
  useSubcategories,
} from "../hooks/useProducts";
import { orderService } from "../services/orderService";
import {
  cartLinesFromOrder,
  sellableUnits,
  toOrderItem,
} from "../utils/variants";
import { orderStatusService } from "../services/websiteService";
import { normalizeOrderStatuses } from "../utils/orderStatuses";
import { imageUrl } from "../utils/assetUrl";

const deliveryAreas = [
  { label: "ঢাকার ভিতরে ৮০ টাকা", fee: 80 },
  {
    label: "ঢাকার বাইরে ১৩০ টাকা",
    fee: 130,
    legacyLabels: ["ঢাকার বাইরে ১২০ টাকা"],
  },
  { label: "চট্টগ্রাম ১৫০ টাকা", fee: 150 },
  { label: "সিলেট ১৫০ টাকা", fee: 150 },
  { label: "রাজশাহী ১৩০ টাকা", fee: 130 },
  { label: "খুলনা ১৩০ টাকা", fee: 130 },
];

const imgGradients = [
  "from-amber-100 to-yellow-200",
  "from-orange-100 to-amber-200",
  "from-yellow-100 to-orange-100",
  "from-red-100 to-orange-200",
  "from-amber-200 to-yellow-300",
  "from-orange-200 to-red-100",
];

function parseImages(images) {
  if (Array.isArray(images)) return images;
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return images ? [images] : [];
    }
  }
  return [];
}

function imageValue(image) {
  if (!image) return "";
  if (typeof image === "string") return image;
  return (
    image.url || image.file || image.filename || image.name || image.path || ""
  );
}

function productImageSrc(image) {
  const src = imageValue(image).trim();
  return imageUrl(src);
}

function toId(value) {
  return value === undefined || value === null ? "" : String(value);
}

// Build tracking timeline from order status
function buildTracking(order, statuses) {
  const allSteps = statuses.map((status) => status.key);
  const specialEnd = ["cancelled", "returned", "incomplete", "on_hold"];
  const statusByKey = Object.fromEntries(
    statuses.map((status) => [status.key, status]),
  );

  if (specialEnd.includes(order.status)) {
    return [
      {
        label: statusByKey.pending?.label || "Pending",
        date: order.date,
        done: true,
        color: statusByKey.pending?.color || "#f59e0b",
      },
      {
        label: statusByKey[order.status]?.label || order.status,
        date: order.date,
        done: true,
        color: statusByKey[order.status]?.color || "#ef4444",
        current: true,
      },
    ];
  }

  const currentIdx = allSteps.indexOf(order.status);
  return allSteps.map((step, i) => ({
    label: statusByKey[step]?.label || step,
    date: currentIdx >= 0 && i <= currentIdx ? order.date : null,
    done: currentIdx >= 0 && i <= currentIdx,
    current: i === currentIdx,
    color: statusByKey[step]?.color || "#6b7280",
  }));
}

export default function EditOrderPage({
  order,
  onNavigate,
  onCountsRefresh,
  onPrintOrder,
}) {
  const [orderStatusOptions, setOrderStatusOptions] = useState(() =>
    normalizeOrderStatuses(),
  );
  // Pre-fill cart from the stored order lines (legacy orders become a single line).
  const [initialOrder] = useState(() => cartLinesFromOrder(order));
  const [cart, setCart] = useState(initialOrder.lines);

  const [phone, setPhone] = useState(order.customerPhone || "");
  const [customerName, setCustomerName] = useState(order.customerName || "");
  // Older manual orders saved the delivery-area label (e.g. "ঢাকার বাইরে ১২০ টাকা")
  // as customerArea — treat that as the area selection, not the address.
  const savedAreaText = String(order.customerArea || "").trim();
  const savedAreaIdx = deliveryAreas.findIndex(
    (area) =>
      area.label === savedAreaText ||
      (area.legacyLabels || []).includes(savedAreaText),
  );
  const [address, setAddress] = useState(
    [savedAreaIdx >= 0 ? "" : order.customerArea, order.customerDistrict]
      .filter(Boolean)
      .join(", "),
  );
  const [areaIdx, setAreaIdx] = useState(Math.max(0, savedAreaIdx));
  // Keep the order's current delivery charge until staff pick an area.
  const [shippingFee, setShippingFee] = useState(() =>
    initialOrder.legacy ? 0 : initialOrder.deliveryCharge,
  );
  const [discount, setDiscount] = useState(
    initialOrder.discount ? String(initialOrder.discount) : "",
  );
  const [advanced, setAdvanced] = useState(String(order.advance || 0));
  const [orderStatus, setOrderStatus] = useState(order.status || "pending");
  const [isGuest, setIsGuest] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // API products
  const { data: rawProducts, loading: productsLoading } = useProducts({
    limit: 500,
  });
  const { data: rawCategories } = useCategories({ limit: 500 });
  const { data: rawSubcategories } = useSubcategories({ limit: 500 });
  const { data: rawChildcategories } = useChildcategories({ limit: 500 });

  useEffect(() => {
    let mounted = true;
    orderStatusService
      .getAll({ limit: 100 })
      .then((res) => {
        if (mounted)
          setOrderStatusOptions(normalizeOrderStatuses(res.data || []));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Product panel
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedCat, setExpandedCat] = useState(null);
  const [expandedSub, setExpandedSub] = useState(null);

  // Cart helpers
  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing)
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...prev, { ...product, qty: 1, disc: 0 }];
    });
  }
  function removeFromCart(id) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }
  function changeQty(id, delta) {
    setCart((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i,
      ),
    );
  }
  function changeDisc(id, val) {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, disc: Number(val) || 0 } : i)),
    );
  }
  function clearCart() {
    setCart([]);
  }

  // Calculations
  const subTotal = cart.reduce((sum, i) => sum + i.price * i.qty - i.disc, 0);
  const discountAmt = Number(discount) || 0;
  const paidAmt = Number(advanced) || 0;
  const total = subTotal + shippingFee - discountAmt;

  const categoryTree = useMemo(() => {
    const childrenBySub = rawChildcategories.reduce((acc, child) => {
      const subcategoryId = toId(child.subcategoryId || child.subcategory?.Id);
      if (!subcategoryId) return acc;
      acc[subcategoryId] = acc[subcategoryId] || [];
      acc[subcategoryId].push(child);
      return acc;
    }, {});
    const subsByCategory = rawSubcategories.reduce((acc, sub) => {
      const categoryId = toId(sub.categoryId || sub.category?.Id);
      if (!categoryId) return acc;
      acc[categoryId] = acc[categoryId] || [];
      acc[categoryId].push({
        ...sub,
        children: childrenBySub[toId(sub.Id)] || [],
      });
      return acc;
    }, {});

    return rawCategories.map((category) => ({
      ...category,
      children: subsByCategory[toId(category.Id)] || [],
    }));
  }, [rawCategories, rawSubcategories, rawChildcategories]);

  // Product filter from API
  const filteredProducts = useMemo(() => {
    const mapped = rawProducts.flatMap((p) => {
      const images = parseImages(p.images).map(imageValue).filter(Boolean);
      const category = {
        categoryId: toId(p.categoryId || p.category?.Id),
        subcategoryId: toId(p.subcategoryId || p.subcategory?.Id),
        childcategoryId: toId(p.childcategoryId || p.childcategory?.Id),
        brand: p.brand?.name || p.brandName || "",
      };
      return sellableUnits(p, images).map((unit) => ({ ...unit, ...category }));
    });
    const q = search.trim().toLowerCase();
    return mapped.filter((product) => {
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (activeCategory === "all") return true;
      const [type, id] = activeCategory.split(":");
      if (type === "category") return product.categoryId === id;
      if (type === "subcategory") return product.subcategoryId === id;
      if (type === "childcategory") return product.childcategoryId === id;
      return true;
    });
  }, [rawProducts, search, activeCategory]);

  async function handleUpdate() {
    if (cart.length === 0) return;
    if (!isGuest && !address.trim()) {
      alert("Customer এর পুরো ঠিকানা দিন");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customerName: isGuest ? "Guest" : customerName.trim() || "Guest",
        customerPhone: isGuest ? "Guest" : phone.trim(),
        customerArea: address.trim() || null,
        items: cart.map(toOrderItem),
        deliveryCharge: shippingFee,
        discount: discountAmt,
        advance: paidAmt || 0,
        status: orderStatus,
      };
      await orderService.updateOrder(order.Id, payload);
      await onCountsRefresh?.();
      alert("Order সফলভাবে update হয়েছে!");
      onNavigate && onNavigate("orders");
    } catch (err) {
      alert(err.message || "Update করতে সমস্যা হয়েছে");
    } finally {
      setSubmitting(false);
    }
  }

  const tracking = buildTracking(
    { ...order, status: orderStatus },
    orderStatusOptions,
  );
  const invoiceNo = order.orderId || `#${order.Id}`;
  const currentStatusInfo = orderStatusOptions.find(
    (s) => s.key === orderStatus,
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-gray-50">
      {/* Top Nav */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 flex-shrink-0 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate("dashboard")}
            className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
          >
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button
            onClick={() => onNavigate("orders")}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
          >
            <ShoppingBag size={14} /> Order
          </button>
          <button
            onClick={clearCart}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
          >
            <Trash2 size={14} /> Cart Clear
          </button>
          <button
            onClick={onPrintOrder}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
          >
            <Printer size={14} /> Print Order
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-1">
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
              29
            </span>
            <div className="w-5 h-5 text-gray-500">🔔</div>
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-hidden xl:flex-row">
        {/* ════ LEFT PANEL ════ */}
        <div className="flex max-h-[48vh] w-full flex-shrink-0 flex-col overflow-y-auto border-b border-gray-200 bg-white pl-3 xl:max-h-none xl:w-[520px] xl:border-b-0 xl:border-r">
          {/* Title */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h1 className="text-base font-bold text-gray-800">Order Edit</h1>
            <button className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">
              <PlayCircle size={13} /> টিউটোরিয়াল দেখুন
            </button>
          </div>

          {/* Cart table */}
          <div className="overflow-x-auto flex-shrink-0">
            <table className="w-full text-xs">
              <thead>
                <tr
                  style={{
                    background: "linear-gradient(90deg, #14b8a6, #0ea5e9)",
                  }}
                >
                  <th className="px-3 py-2.5 text-left text-white font-semibold">
                    Product
                  </th>
                  <th className="px-3 py-2.5 text-left text-white font-semibold">
                    Details
                  </th>
                  <th className="px-3 py-2.5 text-center text-white font-semibold">
                    Quantity
                  </th>
                  <th className="px-3 py-2.5 text-center text-white font-semibold">
                    Discount
                  </th>
                  <th className="px-3 py-2.5 text-right text-white font-semibold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-400">
                      কোনো পণ্য নেই
                    </td>
                  </tr>
                )}
                {cart.map((item) => (
                  <CartRow
                    key={item.id}
                    item={item}
                    onRemove={() => removeFromCart(item.id)}
                    onQty={(d) => changeQty(item.id, d)}
                    onDisc={(v) => changeDisc(item.id, v)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Customer & order form */}
          <div className="px-4 py-3 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isGuest}
                onChange={(e) => setIsGuest(e.target.checked)}
                className="accent-teal-500 w-3.5 h-3.5"
              />
              <span className="text-xs font-medium text-gray-700">
                Guest Customer
              </span>
            </label>

            {!isGuest && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
              </div>
            )}

            {/* Address */}
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Delivery Address"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-300"
            />

            {/* Area */}
            <div className="relative">
              <select
                value={areaIdx}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setAreaIdx(idx);
                  setShippingFee(deliveryAreas[idx].fee);
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-300 appearance-none pr-8"
              >
                {deliveryAreas.map((a, i) => (
                  <option key={i} value={i}>
                    {a.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>

            {/* Shipping */}
            <input
              type="number"
              value={shippingFee}
              onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="Shipping Fee"
            />

            {/* Discount */}
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="Discount"
            />

            {/* Advanced / Paid */}
            <input
              type="number"
              value={advanced}
              onChange={(e) => setAdvanced(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="Paid Amount"
            />

            {/* Status dropdown */}
            <div className="relative">
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-300 appearance-none pr-8"
                style={{ color: currentStatusInfo?.color }}
              >
                {orderStatusOptions.map((s) => (
                  <option key={s.key} value={s.key} style={{ color: s.color }}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>

            {/* Summary */}
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              {[
                { label: "Sub Total", value: subTotal },
                { label: "Shipping Fee (+)", value: shippingFee },
                { label: "Discount (-)", value: discountAmt },
                { label: "Paid (-)", value: paidAmt },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-4 py-2 border-b border-gray-100 text-xs"
                >
                  <span className="text-gray-600">{row.label}</span>
                  <span className="font-medium text-gray-800">{row.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 text-xs">
                <span className="font-bold text-gray-800">Total</span>
                <span className="font-bold text-teal-600 text-sm">
                  ৳ {total}
                </span>
              </div>
            </div>

            {/* Update button */}
            <button
              onClick={handleUpdate}
              disabled={cart.length === 0 || submitting}
              className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white font-semibold text-sm py-2.5 rounded-xl transition"
            >
              {submitting ? "Update হচ্ছে..." : "Update Order"}
            </button>
          </div>

          {/* ── Tracking Timeline ── */}
          <div className="mx-4 mb-4 mt-1">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-bold text-gray-800">
                  Tracking — Invoice #{invoiceNo}
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-amber-200" />

                  <div className="space-y-0">
                    {tracking.map((step, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 pb-4 last:pb-0"
                      >
                        {/* Circle */}
                        <div
                          className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            step.done ? "shadow-md" : "bg-gray-200"
                          }`}
                          style={step.done ? { background: step.color } : {}}
                        >
                          {step.done && (
                            <Check
                              size={12}
                              className="text-white"
                              strokeWidth={3}
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div
                          className={`flex-1 rounded-lg px-3 py-2 ${step.current ? "border border-amber-300 bg-amber-50" : "bg-gray-50"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="text-sm font-bold"
                              style={{
                                color: step.current ? step.color : "#374151",
                              }}
                            >
                              {step.label}
                            </span>
                            {step.date && (
                              <span className="text-[10px] text-gray-500">
                                {step.date}
                              </span>
                            )}
                          </div>
                          {step.current && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              আপনার অর্ডারটি সফলভাবে পৌঁছেছে
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden sm:flex-row">
          {/* Category sidebar */}
          <div className="max-h-44 w-full flex-shrink-0 overflow-y-auto border-b border-gray-200 bg-white py-2 sm:max-h-none sm:w-40 sm:border-b-0 sm:border-r">
            <div
              onClick={() => {
                setActiveCategory("all");
                setExpandedCat(null);
                setExpandedSub(null);
              }}
              className={`px-3 py-2.5 cursor-pointer text-xs font-medium transition ${
                activeCategory === "all"
                  ? "bg-teal-500 text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              All
            </div>
            {categoryTree.map((cat) => {
              const categoryKey = `category:${cat.Id}`;
              const isExpanded = expandedCat === cat.Id;
              return (
                <div key={cat.Id}>
                  <div
                    onClick={() => {
                      setActiveCategory(categoryKey);
                      setExpandedCat(isExpanded ? null : cat.Id);
                      setExpandedSub(null);
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer text-xs font-medium transition ${
                      activeCategory === categoryKey
                        ? "bg-teal-500 text-white"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{cat.name}</span>
                    {cat.children.length > 0 &&
                      (isExpanded ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      ))}
                  </div>
                  {cat.children.length > 0 && isExpanded && (
                    <div className="bg-gray-50 border-l-2 border-teal-400 ml-3">
                      {cat.children.map((sub) => {
                        const subKey = `subcategory:${sub.Id}`;
                        const isSubExpanded = expandedSub === sub.Id;
                        return (
                          <div key={sub.Id}>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCategory(subKey);
                                setExpandedSub(isSubExpanded ? null : sub.Id);
                              }}
                              className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition ${
                                activeCategory === subKey
                                  ? "bg-teal-50 text-teal-700 font-semibold"
                                  : "text-gray-600 hover:bg-teal-50 hover:text-teal-700"
                              }`}
                            >
                              <span>{sub.name}</span>
                              {sub.children.length > 0 &&
                                (isSubExpanded ? (
                                  <ChevronDown size={11} />
                                ) : (
                                  <ChevronRight size={11} />
                                ))}
                            </div>
                            {sub.children.length > 0 && isSubExpanded && (
                              <div className="ml-3 border-l border-teal-200">
                                {sub.children.map((child) => {
                                  const childKey = `childcategory:${child.Id}`;
                                  return (
                                    <div
                                      key={child.Id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCategory(childKey);
                                      }}
                                      className={`px-3 py-1.5 text-[11px] cursor-pointer transition ${
                                        activeCategory === childKey
                                          ? "text-teal-700 font-semibold"
                                          : "text-gray-500 hover:text-teal-700"
                                      }`}
                                    >
                                      {child.name}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Products */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-gray-50">
            <div className="px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Product or Scan Barcode ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 pr-10"
                />
                <Search
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {productsLoading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                  পণ্য লোড হচ্ছে...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((product, i) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      gradient={imgGradients[i % imgGradients.length]}
                      inCart={cart.some((c) => c.id === product.id)}
                      onAdd={() => addToCart(product)}
                    />
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-400 text-sm">
                      কোনো পণ্য পাওয়া যায়নি
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 py-1.5 border-t border-gray-100 bg-white flex-shrink-0">
        © Holy Gift{" "}
        <span className="text-blue-500 cursor-pointer">DigitalEver</span>
      </div>
    </div>
  );
}

/* ── Cart Row ── */
function CartRow({ item, onRemove, onQty, onDisc }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-3 py-2">
        <div className="relative w-10 h-10">
          <button
            onClick={onRemove}
            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center z-10 transition shadow border-2 border-white"
          >
            <X size={10} strokeWidth={3} />
          </button>
          <div className="w-10 h-10 rounded bg-gradient-to-br from-amber-100 to-yellow-200 border border-amber-200 flex items-center justify-center text-lg">
            🧴
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold text-gray-800 text-xs leading-tight max-w-[120px]">
          {item.name}
        </div>
        <div className="text-gray-500 text-[10px] mt-0.5">
          ৳ {item.price} × {item.qty}
        </div>
        <span className="bg-teal-100 text-teal-700 text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block">
          12ml
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 justify-center">
          <button
            onClick={() => onQty(-1)}
            className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center transition"
          >
            <Minus size={11} />
          </button>
          <span className="w-6 text-center text-xs font-semibold">
            {item.qty}
          </span>
          <button
            onClick={() => onQty(1)}
            className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center transition"
          >
            <Plus size={11} />
          </button>
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={item.disc}
          onChange={(e) => onDisc(e.target.value)}
          min={0}
          className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-teal-300"
        />
      </td>
      <td className="px-3 py-2 text-right font-bold text-gray-800 text-xs whitespace-nowrap">
        ৳{item.price * item.qty - item.disc}
      </td>
    </tr>
  );
}

/* ── Product Card ── */
function ProductCard({ product, gradient, inCart, onAdd }) {
  return (
    <div
      onClick={onAdd}
      className={`bg-white rounded-xl border cursor-pointer transition-all duration-150 overflow-hidden group ${
        inCart
          ? "border-teal-400 shadow-md shadow-teal-100"
          : "border-gray-200 hover:border-teal-300 hover:shadow-md"
      }`}
    >
      <div
        className={`relative bg-gradient-to-br ${gradient} h-28 flex items-center justify-center`}
      >
        {product.images?.[0] ? (
          <img
            src={productImageSrc(product.images[0])}
            alt={product.name}
            className="h-24 w-full object-contain"
          />
        ) : (
          <div className="w-16 h-20 bg-white/40 rounded-lg flex items-center justify-center">
            <div className="text-2xl">🧴</div>
          </div>
        )}
        <div
          className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition ${
            inCart ? "bg-teal-500" : "bg-white/80 group-hover:bg-teal-100"
          }`}
        >
          <ShoppingCart
            size={12}
            className={
              inCart ? "text-white" : "text-gray-500 group-hover:text-teal-600"
            }
          />
        </div>
        {inCart && (
          <div className="absolute top-2 left-2 bg-teal-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            Added
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide truncate">
          {product.brand}
        </div>
        <div className="text-xs font-semibold text-gray-800 leading-tight mt-0.5 line-clamp-2 min-h-[28px]">
          {product.name}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs font-bold text-teal-600">
            ৳ {product.price}
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              product.stock <= 4
                ? "bg-red-100 text-red-600"
                : "bg-green-100 text-green-600"
            }`}
          >
            Stock: {product.stock}
          </span>
        </div>
      </div>
    </div>
  );
}
