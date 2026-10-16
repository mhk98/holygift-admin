import { apiRequest, buildQuery } from '../utils/apiClient';

export const landingPageService = {
  getAll: (params = {}) => apiRequest(`/landing-pages${buildQuery(params)}`),
  getOne: (id) => apiRequest(`/landing-pages/${id}`),
  getPublicOne: (id) => apiRequest(`/landing-pages/public/${id}`),
  create: (data) => apiRequest('/landing-pages/create', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/landing-pages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/landing-pages/${id}`, { method: 'DELETE' }),
  getHeader: () => apiRequest('/landing-pages/header'),
  getPublicHeader: () => apiRequest('/landing-pages/header/public'),
  updateHeader: (data) => apiRequest('/landing-pages/header', { method: 'PUT', body: JSON.stringify(data) }),
  getFooter: () => apiRequest('/landing-pages/footer'),
  getPublicFooter: () => apiRequest('/landing-pages/footer/public'),
  updateFooter: (data) => apiRequest('/landing-pages/footer', { method: 'PUT', body: JSON.stringify(data) }),
};
