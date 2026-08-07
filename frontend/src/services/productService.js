import api from './api';

export const productService = {
  getAll: async (search = '') => {
    const res = await api.get(`/products?search=${search}`);
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/products', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/products/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/products/${id}`);
    return res.data;
  }
};

export const inventoryService = {
  importGoods: async (data) => {
    const res = await api.post('/inventory/import', data);
    return res.data;
  },
  getImports: async () => {
    const res = await api.get('/inventory/imports');
    return res.data;
  }
};

export const posService = {
  checkout: async (data) => {
    const res = await api.post('/pos/checkout', data);
    return res.data;
  },
  getSales: async (params = {}) => {
    const res = await api.get('/pos/sales', { params });
    return res.data;
  },
  getOrderStatus: async (id) => {
    const res = await api.get(`/pos/order-status/${id}`);
    return res.data;
  },
  confirmPayment: async (id) => {
    const res = await api.patch(`/pos/orders/${id}/confirm`);
    return res.data;
  },
  cancelOrder: async (id) => {
    const res = await api.patch(`/pos/orders/${id}/cancel`);
    return res.data;
  }
};



