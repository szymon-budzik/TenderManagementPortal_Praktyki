import api from '../api';

export const getSharePeers = () => api.get('/shares/peers').then((r) => r.data);
export const getReceivedTenders = () => api.get('/shares/tenders').then((r) => r.data);
export const getSharedTendersBadge = () => api.get('/shares/tenders/badge').then((r) => r.data);

export const shareTendersToUsers = (recipientUserIds, tenderIds, note = '') =>
  api.post('/shares/tenders', { recipientUserIds, tenderIds, note }).then((r) => r.data);

export const shareReportsToUsers = (recipientUserIds, runIds, note = '') =>
  api.post('/shares/reports', { recipientUserIds, runIds, note }).then((r) => r.data);

export const markAllSharedTendersRead = () => api.patch('/shares/tenders/read-all');
export const markSharedTenderRead = (id) => api.patch(`/shares/tenders/${id}/read`);
export const deleteReceivedTender = (id) => api.delete(`/shares/tenders/${id}`);

export const createReportFromShared = (sharedTenderIds, reportName = '') =>
  api
    .post('/shares/tenders/report', { sharedTenderIds, reportName: reportName || null })
    .then((r) => r.data);
