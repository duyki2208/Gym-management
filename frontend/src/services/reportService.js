import api from './api';

const getSummary = async (params = {}) => {
  const response = await api.get('/reports/summary', { params });
  return response.data;
};

const getRevenueChart = async (params = {}) => {
  const response = await api.get('/reports/revenue', { params });
  return response.data;
};

const getPackageDistribution = async (params = {}) => {
  const response = await api.get('/reports/packages', { params });
  return response.data;
};

const getExpiringMembers = async (params = {}) => {
  const response = await api.get('/reports/expiring', { params });
  return response.data;
};

const getRevenueDetails = async (params = {}) => {
  const response = await api.get('/reports/revenue-details', { params });
  return response.data;
};

const getInventoryReport = async (params = {}) => {
  const response = await api.get('/reports/inventory', { params });
  return response.data;
};

const getChurnPrediction = async (params = {}) => {
  const response = await api.get('/reports/churn-prediction', { params });
  return response.data;
};

const getAuditLogs = async (params = {}) => {
  const response = await api.get('/audit-logs', { params });
  return response.data;
};

const getRevenueAdvanced = async (params = {}) => {
  const response = await api.get('/reports/revenue-advanced', { params });
  return response.data;
};

const getHRSummary = async (params = {}) => {
  const response = await api.get('/reports/hr-summary', { params });
  return response.data;
};

const getCustomerAnalytics = async (params = {}) => {
  const response = await api.get('/reports/customer-analytics', { params });
  return response.data;
};

const getNotificationsSummary = async (params = {}) => {
  const response = await api.get('/reports/notifications-summary', { params });
  return response.data;
};

export default {
  getSummary,
  getRevenueChart,
  getPackageDistribution,
  getExpiringMembers,
  getRevenueDetails,
  getInventoryReport,
  getChurnPrediction,
  getAuditLogs,
  getRevenueAdvanced,
  getHRSummary,
  getCustomerAnalytics,
  getNotificationsSummary
};

