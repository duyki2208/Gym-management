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

export default {
  getSummary,
  getRevenueChart,
  getPackageDistribution,
  getExpiringMembers,
  getRevenueDetails
};

