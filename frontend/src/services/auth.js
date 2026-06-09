import api from './api.js';

const authService = {
  async register({ name, email, password, role, instructorCode }) {
    const data = await api.postPublic('/api/auth/register', { name, email, password, role, instructorCode });
    if (data.success) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  async login({ email, password }) {
    const data = await api.postPublic('/api/auth/login', { email, password });
    if (data.success) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  async getMe() {
    return api.get('/api/auth/me');
  },

  async changePassword({ currentPassword, newPassword }) {
    return api.put('/api/auth/change-password', { currentPassword, newPassword });
  },

  async updateProfile({ name }) {
    return api.put('/api/auth/update-profile', { name });
  },

  async forgotPassword(email) {
    return api.postPublic('/api/auth/forgot-password', { email });
  },

  logout() {
    api.clearAuth();
  },

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('token');
  },

  getUserRole() {
    const user = this.getCurrentUser();
    return user ? user.role : null;
  },

  // === Admin endpoint'leri ===

  // Tüm kullanıcıları listele (role filtresi opsiyonel)
  async getAllUsers(role) {
    const url = role ? `/api/users?role=${role}` : '/api/users';
    return api.get(url);
  },

  // Admin tarafından doğrudan kullanıcı oluştur
  async createUser({ name, email, password, role }) {
    return api.post('/api/users', { name, email, password, role });
  },

  // Yeni eğitmen kodu üret
  async generateInstructorCode() {
    return api.post('/api/users/instructor-codes', {});
  },

  // Üretilen kodları listele
  async listInstructorCodes() {
    return api.get('/api/users/instructor-codes');
  },
};

export default authService;