import api from '../api';

export const getUsers = async () => {
  const res = await api.get('/admin/users');
  return Array.isArray(res.data) ? res.data : res.data?.content || [];
};

export const createUser = async (payload) => {
  const res = await api.post('/admin/users', payload);
  return res.data;
};

export const updateUser = async (id, payload) => {
  const res = await api.patch(`/admin/users/${id}`, payload);
  return res.data;
};

export const deleteUser = async (id) => {
  await api.delete(`/admin/users/${id}`);
};
