import api from '../api';

export const getProfiles = async () => {
  const res = await api.get('/automation/profiles');
  return res.data || [];
};

export const createProfile = async (payload) => {
  const res = await api.post('/automation/profiles', payload);
  return res.data;
};

export const updateProfile = async (id, payload) => {
  const res = await api.put(`/automation/profiles/${id}`, payload);
  return res.data;
};

export const deleteProfile = async (id) => {
  await api.delete(`/automation/profiles/${id}`);
};

export const triggerProfile = async (id) => {
  const res = await api.post(`/automation/profiles/${id}/trigger`);
  return res.data;
};

export const getRuns = async () => {
  const res = await api.get('/automation/runs');
  return res.data || [];
};

export const getReportsBadge = async () => {
  const res = await api.get('/automation/runs/badge');
  return res.data || { totalCount: 0, unreadCount: 0 };
};

export const markAllRunsRead = async () => {
  await api.patch('/automation/runs/read-all');
};

export const deleteRun = async (id) => {
  await api.delete(`/automation/runs/${id}`);
};

export const exportRunsExcel = async (runIds) => {
  const res = await api.post('/automation/runs/export', { runIds });
  return res.data;
};

export const sendRunsEmail = async ({ runIds, emails, smtpAccountId }) => {
  const res = await api.post('/automation/runs/email', {
    runIds,
    emails,
    smtpAccountId,
  });
  return res.data;
};

export const getSmtpAccounts = async () => {
  const res = await api.get('/automation/smtp-accounts');
  return res.data || [];
};

export const getNotificationPreferences = async () => {
  const res = await api.get('/automation/notifications/preferences');
  return res.data || { sharedTendersEnabled: true, sharedReportsEnabled: true };
};

export const updateNotificationPreferences = async (payload) => {
  const res = await api.patch('/automation/notifications/preferences', payload);
  return res.data;
};
