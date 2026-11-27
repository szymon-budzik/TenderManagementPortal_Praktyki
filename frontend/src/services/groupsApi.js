import api from '../api';

export const getGroupsHierarchy = () => api.get('/groups').then((r) => r.data);
export const getAssignableUsers = () => api.get('/groups/users').then((r) => r.data);
export const createGroup = (payload) => api.post('/groups', payload).then((r) => r.data);
export const updateGroup = (id, payload) => api.put(`/groups/${id}`, payload).then((r) => r.data);
export const deleteGroup = (id) => api.delete(`/groups/${id}`);
export const setGroupMembers = (groupId, userIds) =>
  api.put(`/groups/${groupId}/members`, { userIds }).then((r) => r.data);
export const addGroupMember = (groupId, userId) =>
  api.post(`/groups/${groupId}/members/${userId}`).then((r) => r.data);
export const removeGroupMember = (groupId, userId) =>
  api.delete(`/groups/${groupId}/members/${userId}`).then((r) => r.data);
