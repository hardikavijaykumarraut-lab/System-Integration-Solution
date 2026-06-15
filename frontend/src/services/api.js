import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL;
const API_URL = rawApiUrl
  ? rawApiUrl.startsWith('http')
    ? rawApiUrl
    : rawApiUrl.startsWith('//')
      ? `${window.location.protocol}${rawApiUrl}`
      : rawApiUrl.startsWith(':')
        ? `${window.location.protocol}//${window.location.hostname}${rawApiUrl}`
        : rawApiUrl
  : '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors - don't auto-refresh, just logout
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Clear auth data and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      
      // Only redirect if not already on login/register page
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getStats: () => api.get('/users/stats'),
  getRoles: () => api.get('/users/roles'),
};

// Departments API
export const departmentsAPI = {
  getAll: (params) => api.get('/departments', { params }),
  getById: (id) => api.get(`/departments/${id}`),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
  activate: (id) => api.post(`/departments/${id}/activate`),
  getMembers: (id) => api.get(`/departments/${id}/members`),
  getStats: (id) => api.get(`/departments/${id}/stats`),
  // Services management
  getServices: (id) => api.get(`/departments/${id}/services`),
  addService: (id, data) => api.post(`/departments/${id}/services`, data),
  updateService: (serviceId, data) => api.put(`/departments/services/${serviceId}`, data),
  deleteService: (serviceId) => api.delete(`/departments/services/${serviceId}`),
};

// Projects API
export const projectsAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  updateStatus: (id, status) => api.put(`/projects/${id}`, { status }),
  delete: (id) => api.delete(`/projects/${id}`),
  addMember: (id, userId) => api.post(`/projects/${id}/add-member`, { user_id: userId }),
  removeMember: (id, userId) => api.post(`/projects/${id}/remove-member`, { user_id: userId }),
  getStats: () => api.get('/projects/stats'),
};

// Tasks API
export const tasksAPI = {
  getAll: (params) => api.get('/tasks', { params }),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  getByProject: (projectId) => api.get(`/tasks/by-project/${projectId}`),
  getMyTasks: (params) => api.get('/tasks/my-tasks', { params }),
  addComment: (id, content) => api.post(`/tasks/${id}/comments`, { content }),
  getStats: () => api.get('/tasks/stats'),
};

// Chat API
export const chatAPI = {
  getConversations: () => api.get('/chat/conversations'),
  createConversation: (data) => api.post('/chat/conversations', data),
  validateConversation: (data) => api.post('/chat/conversations/validate', data),
  getMessages: (roomId, params) => api.get(`/chat/messages/${roomId}`, { params }),
  sendMessage: (data) => api.post('/chat/messages', data),
  markAsRead: (messageId) => api.post(`/chat/messages/${messageId}/read`),
  getUnreadCount: () => api.get('/chat/unread-count'),
  searchUsers: (query) => api.get('/chat/users/search', { params: { q: query } }),
  adminMonitor: () => api.get('/chat/admin/monitor'),
};

// AI Chatbot API
export const aiChatbotAPI = {
  chat: (data) => api.post('/ai-chatbot/chat', data),
  getHistory: (params) => api.get('/ai-chatbot/history', { params }),
  getCapabilities: () => api.get('/ai-chatbot/capabilities'),
  clearHistory: () => api.delete('/ai-chatbot/clear-history'),
};

// Accounting API
export const accountingAPI = {
  getTransactions: (params) => api.get('/accounting/transactions', { params }),
  createTransaction: (data) => api.post('/accounting/transactions', data),
  getTransaction: (id) => api.get(`/accounting/transactions/${id}`),
  updateTransaction: (id, data) => api.put(`/accounting/transactions/${id}`, data),
  deleteTransaction: (id) => api.delete(`/accounting/transactions/${id}`),
  getSummary: (params) => api.get('/accounting/summary', { params }),
  getCategories: () => api.get('/accounting/categories'),
  getProjectCosts: (projectId) => api.get(`/accounting/project/${projectId}/costs`),
  // Team Leader Accounting
  getTeamLeaderWages: () => api.get('/accounting/team-leader/wages'),
  getTeamLeaderPayments: () => api.get('/accounting/team-leader/payments'),
  createTeamLeaderPayment: (data) => api.post('/accounting/team-leader/payments', data),
  // Team Member Earnings
  getTeamMemberEarnings: () => api.get('/accounting/team-member/earnings'),
  getTeamMemberHours: () => api.get('/accounting/team-member/hours'),
};

// Dashboard API
export const dashboardAPI = {
  getAdmin: () => api.get('/dashboard/admin'),
  getTeamLeader: () => api.get('/dashboard/team-leader'),
  getTeamMember: () => api.get('/dashboard/team-member'),
  getClient: () => api.get('/dashboard/client'),
};

// Clients API
export const clientsAPI = {
  getAll: (params) => api.get('/clients', { params }),
  getById: (id) => api.get(`/clients/${id}`),
  getProjects: (id) => api.get(`/clients/${id}/projects`),
  getTransactions: (id) => api.get(`/clients/${id}/transactions`),
  getStats: () => api.get('/clients/stats'),
  updateProfile: (id, data) => api.put(`/clients/${id}/profile`, data),
  checkProfile: () => api.get('/clients/profile-status'),
};

// Reports API
export const reportsAPI = {
  getProjectProgress: (params) => api.get('/reports/project-progress', { params }),
  getDepartmentPerformance: () => api.get('/reports/department-performance'),
  getTeamProductivity: (params) => api.get('/reports/team-productivity', { params }),
  getFinancial: (params) => api.get('/reports/financial', { params }),
  getClientActivity: () => api.get('/reports/client-activity'),
};

// Upload API
export const uploadAPI = {
  uploadProfilePhoto: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/profile-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/general', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  // Custom upload method that accepts pre-built FormData
  uploadFileCustom: (formData) => {
    return api.post('/upload/general', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  downloadFile: (fileData) => {
    return api.post('/upload/download', fileData, {
      responseType: 'blob'
    });
  },
  getFileUrl: (fileData) => {
    return api.post('/upload/download', fileData);
  },
};

// Services API
export const servicesAPI = {
  getAll: (params) => api.get('/services', { params }),
  getDepartments: () => api.get('/services/departments'),
  getPackage: (packageId) => api.get(`/services/packages/${packageId}`),
};

// Requirements API
export const requirementsAPI = {
  submit: (data) => api.post('/requirements', data),
  getAll: (params) => api.get('/requirements', { params }),
  getById: (id) => api.get(`/requirements/${id}`),
  getMyRequirement: () => api.get('/requirements/my-requirement'),
  getAssigned: () => api.get('/requirements/assigned'),
  assignTeamLead: (requirementId, data) => api.post(`/requirements/${requirementId}/assign`, data),
  toggleDocumentAccess: (requirementId, enabled) => api.put(`/requirements/${requirementId}/document-access`, { enabled }),
};

// Daily Reports API
export const dailyReportsAPI = {
  submit: (data) => api.post('/daily-reports', data),
  getAll: (params) => api.get('/daily-reports', { params }),
  getById: (reportId) => api.get(`/daily-reports/${reportId}`),
  addFeedback: (reportId, data) => api.post(`/daily-reports/${reportId}/feedback`, data),
  getSummary: () => api.get('/daily-reports/summary'),
};

// Payments API
export const paymentsAPI = {
  create: (data) => api.post('/payments', data),
  getMyPayments: () => api.get('/payments/my-payments'),
  getById: (id) => api.get(`/payments/${id}`),
  downloadReceipt: (id) => api.get(`/payments/${id}/receipt`, { responseType: 'blob' }),
  getStats: () => api.get('/payments/stats'),
};

export default api;
