import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const hasDomainMessage = Boolean(error.response?.data?.message);
    if (status === 401 || (status === 403 && !hasDomainMessage)) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        localStorage.removeItem('activeTab');
        window.dispatchEvent(new Event('authForceLogout'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;