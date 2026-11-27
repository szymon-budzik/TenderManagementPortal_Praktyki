import api from '../api';

export const getAiConfigs = () => api.get('/ai-configs').then((r) => r.data);
export const createAiConfig = (payload) => api.post('/ai-configs', payload).then((r) => r.data);
export const updateAiConfig = (id, payload) => api.put(`/ai-configs/${id}`, payload).then((r) => r.data);
export const deleteAiConfig = (id) => api.delete(`/ai-configs/${id}`);
export const fetchAiModels = (payload) => api.post('/ai-configs/fetch-models', payload).then((r) => r.data);