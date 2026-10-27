import { apiRequest, buildQuery } from "../utils/apiClient";

export const scratchCardService = {
  getAll: (params = {}) => apiRequest(`/scratch-cards${buildQuery(params)}`),
  // FormData: fullName, phone, address, prize, note, optional "image".
  create: (formData) => apiRequest("/scratch-cards/create", { method: "POST", body: formData }),
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

// Prizes offered on the storefront form; create/update take FormData (optional "image").
export const scratchCardPrizeService = {
  getAll: () => apiRequest("/scratch-card-prizes"),
  getPublic: () => apiRequest("/scratch-card-prizes/public"),
  create: (formData) => apiRequest("/scratch-card-prizes/create", { method: "POST", body: formData }),
  update: (id, formData) => apiRequest(`/scratch-card-prizes/${id}`, { method: "PUT", body: formData }),
  delete: (id) => apiRequest(`/scratch-card-prizes/${id}`, { method: "DELETE" }),
};
