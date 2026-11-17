import api from './api';
import { readAllPages } from './paginatedList';

export const leadService = {
  getAll: async (params = {}) => ({ data: { success: true, data: await readAllPages(async (page, limit) => {
    const { data } = await api.get('/leads', { params: { ...params, page, limit } });
    if (!data.success) throw new Error(data.message || 'Không thể tải leads');
    return { items: data.data, totalPages: data.pagination?.totalPages ?? 1 };
  }) } }),
  getStaff: () => api.get('/staff'),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  convert: (id) => api.post(`/leads/${id}/convert`),
  delete: (id) => api.delete(`/leads/${id}`),
};
