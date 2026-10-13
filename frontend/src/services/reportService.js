import api from './api';

const inFlightReports = new Map();

const stableParamsKey = (params = {}) => JSON.stringify(
  Object.keys(params).sort().reduce((result, key) => {
    result[key] = params[key];
    return result;
  }, {})
);

const getReport = (path, params = {}, config = {}) => {
  const key = `${path}?${stableParamsKey(params)}`;
  if (inFlightReports.has(key)) return inFlightReports.get(key);

  const request = api.get(path, { ...config, params })
    .then((response) => response.data)
    .finally(() => inFlightReports.delete(key));
  inFlightReports.set(key, request);
  return request;
};

const getSummary = async (params = {}) => {
  return getReport('/reports/summary', params);
};

const getRevenueChart = async (params = {}) => {
  return getReport('/reports/revenue', params);
};

const getPackageDistribution = async (params = {}) => {
  return getReport('/reports/packages', params);
};

const getExpiringMembers = async (params = {}) => {
  return getReport('/reports/expiring', params);
};

const getRevenueDetails = async (params = {}) => {
  return getReport('/reports/revenue-details', params);
};

const getInventoryReport = async (params = {}) => {
  return getReport('/reports/inventory', params);
};

const getChurnPrediction = async (params = {}) => {
  return getReport('/reports/churn-prediction', params);
};

const getAuditLogs = async (params = {}) => {
  return getReport('/audit-logs', params);
};

const getRevenueAdvanced = async (params = {}) => {
  return getReport('/reports/revenue-advanced', params);
};

const getHRSummary = async (params = {}) => {
  return getReport('/reports/hr-summary', params);
};

const getCustomerAnalytics = async (params = {}) => {
  return getReport('/reports/customer-analytics', params);
};

const getNotificationsSummary = async (params = {}) => {
  return getReport('/reports/notifications-summary', params);
};

const getPTSessionsReport = async (params = {}) => {
  return getReport('/reports/pt-sessions', params);
};

const exportPTSessionsExcel = async (params = {}) => {
  const response = await api.get('/reports/pt-sessions/export-excel', {
    params,
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `GymPro_PT_Sessions_${Date.now()}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const submitPTDispute = async (data) => {
  const response = await api.post('/reports/pt-sessions/dispute', data);
  return response.data;
};

const updatePeriodStatus = async (data) => {
  const response = await api.put('/reports/commission-period/status', data);
  return response.data;
};

const getLeadConversionReport = async (params = {}) => {
  return getReport('/reports/leads-conversion', params);
};

const getContractStatusBreakdown = async (params = {}) => {
  return getReport('/reports/contract-status-breakdown', params);
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
  getNotificationsSummary,
  getPTSessionsReport,
  exportPTSessionsExcel,
  submitPTDispute,
  updatePeriodStatus,
  getLeadConversionReport,
  getContractStatusBreakdown,
};

