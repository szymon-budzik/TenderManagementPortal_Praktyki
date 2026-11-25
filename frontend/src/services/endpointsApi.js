import api from '../api';

export const getEndpoints = async () => {
  const res = await api.get('/admin/endpoints');
  return res.data || [];
};

export const getSearchSources = async () => {
  const res = await api.get('/search/sources');
  return res.data || [];
};

export const createEndpoint = async (payload) => {
  const res = await api.post('/admin/endpoints', payload);
  return res.data;
};

export const updateEndpoint = async (id, payload) => {
  const res = await api.put(`/admin/endpoints/${id}`, payload);
  return res.data;
};

export const updateEndpointNotes = async (id, notes) => {
  const res = await api.patch(`/admin/endpoints/${id}/notes`, { notes });
  return res.data;
};

export const deleteEndpoint = async (id) => {
  await api.delete(`/admin/endpoints/${id}`);
};

export const testEndpointConnection = async (id) => {
  const res = await api.post(`/admin/endpoints/${id}/test`);
  return res.data || {};
};
