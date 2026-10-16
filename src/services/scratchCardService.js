import { apiRequest, buildQuery } from "../utils/apiClient";

export const scratchCardService = {
  getAll: (params = {}) => apiRequest(`/scratch-cards${buildQuery(params)}`),
  update: (id, data) => apiRequest(`/scratch-cards/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getAgents: () => apiRequest("/scratch-cards/agents"),
  assign: (ids, agentId) =>
    apiRequest("/scratch-cards/assign", { method: "POST", body: JSON.stringify({ ids, agentId }) }),
  sendToCourier: (provider, ids) =>
    apiRequest(`/scratch-cards/courier/${provider}`, { method: "POST", body: JSON.stringify({ ids }) }),
  syncCourier: (ids) =>
    apiRequest("/scratch-cards/courier/sync", { method: "POST", body: JSON.stringify({ ids }) }),
  delete: (id) => apiRequest(`/scratch-cards/${id}`, { method: "DELETE" }),
};
