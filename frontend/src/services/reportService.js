import axios from 'axios';

// Cấu hình URL cơ sở (nếu chưa có global config)
const API_URL = 'http://localhost:5000/api/reports';

const getSummary = async () => {
  const response = await axios.get(`${API_URL}/summary`);
  return response.data;
};

const getRevenueChart = async () => {
  const response = await axios.get(`${API_URL}/revenue`);
  return response.data;
};

const getPackageDistribution = async () => {
  const response = await axios.get(`${API_URL}/packages`);
  return response.data;
};

const getExpiringMembers = async () => {
  const response = await axios.get(`${API_URL}/expiring`);
  return response.data;
};

export default {
  getSummary,
  getRevenueChart,
  getPackageDistribution,
  getExpiringMembers
};
