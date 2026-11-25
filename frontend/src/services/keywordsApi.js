import api from '../api';

export const getKeywordCategories = async () => {
  const res = await api.get('/keywords');
  return res.data || [];
};

export const createKeywordCategory = async (payload) => {
  const res = await api.post('/keywords', payload);
  return res.data;
};

export const updateKeywordCategory = async (id, payload) => {
  const res = await api.put(`/keywords/${id}`, payload);
  return res.data;
};

export const deleteKeywordCategory = async (id) => {
  await api.delete(`/keywords/${id}`);
};
