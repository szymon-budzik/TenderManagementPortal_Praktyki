import api from '../api';

export const getTenders = async (params = { page: 0, size: 1000 }) => {
  const res = await api.get('/tenders', { params });
  return Array.isArray(res.data) ? res.data : res.data?.content || [];
};

export const getObservedTenders = async () => {
  const res = await api.get('/tenders/observed');
  return res.data || [];
};

export const checkObservedUpdates = async () => {
  const res = await api.post('/tenders/observed/check-updates');
  return res.data;
};

export const createObservedReport = async ({ tenderIds, updateIds, reportName }) => {
  const res = await api.post('/tenders/observed/report', {
    tenderIds,
    updateIds,
    reportName,
  });
  return res.data;
};

export const markTenderUpdatesRead = async (tenderId) => {
  await api.patch(`/tenders/${tenderId}/updates/read`);
};

export const updateTenderStatus = async (tenderId, status) => {
  const res = await api.patch(`/tenders/${tenderId}/status`, { status });
  return res.data;
};

export const updateTenderDeadline = async (tenderId, submissionDeadline) => {
  const res = await api.patch(`/tenders/${tenderId}/deadline`, { submissionDeadline });
  return res.data;
};

export const deleteTender = async (tenderId) => {
  await api.delete(`/tenders/${tenderId}`);
};

export const deleteTenderUpdate = async (updateId) => {
  await api.delete(`/tenders/updates/${updateId}`);
};
