import api from './api';

const getSummary = async () => {
  const response = await api.get('/reports/summary');
  return response.data;
};

const getRevenueChart = async () => {
  const response = await api.get('/reports/revenue');
  return response.data;
};

const getPackageDistribution = async () => {
  const response = await api.get('/reports/packages');
  return response.data;
};

const getExpiringMembers = async () => {
  const response = await api.get('/reports/expiring');
  return response.data;
};

const getRevenueDetails = async () => {
  const response = await api.get('/reports/revenue-details');
  return response.data;
};

const getInventoryReport = async () => {
  const response = await api.get('/reports/inventory');
  return response.data;
};

const getChurnPrediction = async () => {
  const response = await api.get('/reports/churn-prediction');
  return response.data;
};

const getAuditLogs = async (params = {}) => {
  const response = await api.get('/audit-logs', { params });
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
  getAuditLogs
};

