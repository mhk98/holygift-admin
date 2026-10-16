import { apiRequest, buildQuery } from "../utils/apiClient";

export const orderService = {
  getOrders: (params = {}) => apiRequest(`/orders${buildQuery(params)}`),
  getStatusCounts: () => apiRequest("/orders/status-counts"),
  getAssignees: () => apiRequest("/orders/assignees"),
  getOrderById: (id) => apiRequest(`/orders/${id}`),
  getFraudCheck: (id, params = {}) =>
    apiRequest(`/orders/${id}/fraud-check${buildQuery(params)}`),
  trackOrders: (phone) => apiRequest(`/orders/track${buildQuery({ phone })}`),
  createOrder: (data) =>
    apiRequest("/orders", { method: "POST", body: JSON.stringify(data) }),
  // Staff-created orders (POS) — authenticated, staff prices, variant stock tracked.
  createStaffOrder: (data) =>
    apiRequest("/orders/admin", { method: "POST", body: JSON.stringify(data) }),
  saveIncompleteOrder: (data) =>
    apiRequest("/orders/incomplete", { method: "POST", body: JSON.stringify(data) }),
  updateOrder: (id, data) =>
    apiRequest(`/orders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateOrderStatus: (id, status) =>
    apiRequest(`/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  sendToSteadfast: (id, data = {}) =>
    apiRequest(`/orders/${id}/courier/steadfast`, { method: "POST", body: JSON.stringify(data) }),
  sendToPathao: (id, data = {}) =>
    apiRequest(`/orders/${id}/courier/pathao`, { method: "POST", body: JSON.stringify(data) }),
  bulkSendToSteadfast: (orderIds = [], data = {}) =>
    apiRequest("/orders/courier/steadfast/bulk", {
      method: "POST",
      body: JSON.stringify({ ...data, orderIds }),
    }),
  bulkSendToPathao: (orderIds = [], data = {}) =>
    apiRequest("/orders/courier/pathao/bulk", {
      method: "POST",
      body: JSON.stringify({ ...data, orderIds }),
    }),
  bulkAssign: (orderIds = [], employeeId) =>
    apiRequest("/orders/assign", {
      method: "POST",
      body: JSON.stringify({ orderIds, employeeId }),
    }),
  syncSteadfastStatus: (id) =>
    apiRequest(`/orders/${id}/courier/steadfast/status`),
  syncPathaoStatus: (id) =>
    apiRequest(`/orders/${id}/courier/pathao/status`),
  getSteadfastBalance: () => apiRequest("/orders/courier/steadfast/balance"),
  createSteadfastReturn: (id, reason = "") =>
    apiRequest(`/orders/${id}/courier/steadfast/return`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  deleteOrder: (id) =>
    apiRequest(`/orders/${id}`, { method: "DELETE" }),
};
