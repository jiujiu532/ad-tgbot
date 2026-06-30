import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// ─── 统计 ─────────────────────────────────────────────
export const getStats = () => api.get('/stats');

// ─── 账号 ─────────────────────────────────────────────
export const getAccounts = () => api.get('/accounts');
export const createAccount = (data: {
  phone: string;
  api_id: string;
  api_hash: string;
  session_name: string;
  reply_message?: string;
}) => api.post('/accounts', data);
export const updateAccount = (id: number, data: Record<string, unknown>) =>
  api.put(`/accounts/${id}`, data);
export const deleteAccount = (id: number) => api.delete(`/accounts/${id}`);
export const loginAccount = (id: number, data: { phone: string; code?: string; password?: string }) =>
  api.post(`/accounts/${id}/login`, data);
export const startBot = (id: number) => api.post(`/accounts/${id}/start`);
export const stopBot = (id: number) => api.post(`/accounts/${id}/stop`);
export const syncGroups = (id: number) => api.post(`/accounts/${id}/sync-groups`);

// ─── 群组 ─────────────────────────────────────────────
export const getGroups = (accountId?: number) =>
  api.get('/groups', { params: accountId ? { account_id: accountId } : {} });
export const updateGroup = (id: number, data: Record<string, unknown>) =>
  api.put(`/groups/${id}`, data);

// ─── 消息模板 ─────────────────────────────────────────
export const getTemplates = () => api.get('/templates');
export const createTemplate = (data: { name: string; content: string; forward_url?: string }) =>
  api.post('/templates', data);
export const updateTemplate = (id: number, data: Record<string, unknown>) =>
  api.put(`/templates/${id}`, data);
export const deleteTemplate = (id: number) => api.delete(`/templates/${id}`);

// ─── 日志 ─────────────────────────────────────────────
export const getLogs = (params?: { limit?: number; status?: string; account_id?: number }) =>
  api.get('/logs', { params });

// ─── 设置 ─────────────────────────────────────────────
export const getSettings = () => api.get('/settings');
export const updateSettings = (settings: Record<string, string>) =>
  api.put('/settings', { settings });

export default api;
