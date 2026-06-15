import { create } from 'zustand';
import { authAPI, clientsAPI } from '../services/api';

export const useAuthStore = create(
  (set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    isProfileComplete: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.login(credentials);
          const { user, access_token, refresh_token } = response.data.data;
          
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          
          // Check profile completion for clients
          let isProfileComplete = null;
          if (user.role === 'client') {
            try {
              const profileResponse = await clientsAPI.checkProfile();
              isProfileComplete = profileResponse.data.data.profile_completed;
            } catch (e) {
              isProfileComplete = false;
            }
          }
          
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false,
            error: null,
            isProfileComplete 
          });
          return { success: true, user, isProfileComplete };
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error.response?.data?.message || 'Login failed' 
          });
          return { success: false, error: error.response?.data?.message };
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.register(data);
          const { user, access_token, refresh_token } = response.data.data;
          
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          
          // New registrations for clients have incomplete profiles
          const isProfileComplete = user.role !== 'client';
          
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false,
            error: null,
            isProfileComplete 
          });
          return { success: true, user, isProfileComplete };
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error.response?.data?.message || 'Registration failed' 
          });
          return { success: false, error: error.response?.data?.message };
        }
      },

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false,
          error: null,
          isProfileComplete: null 
        });
      },

      fetchUser: async () => {
        try {
          const response = await authAPI.getMe();
          const user = response.data.data;
          
          // Check profile completion for clients
          let isProfileComplete = null;
          if (user.role === 'client') {
            try {
              const profileResponse = await clientsAPI.checkProfile();
              isProfileComplete = profileResponse.data.data.profile_completed;
            } catch (e) {
              isProfileComplete = false;
            }
          }
          
          set({ 
            user, 
            isAuthenticated: true,
            isProfileComplete 
          });
          return { user, isProfileComplete };
        } catch (error) {
          set({ 
            user: null, 
            isAuthenticated: false,
            isProfileComplete: null 
          });
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          throw error;
        }
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } });
      },
      
      setProfileComplete: (complete) => {
        set({ isProfileComplete: complete });
      },
      
      checkProfileStatus: async () => {
        const { user } = get();
        if (user?.role !== 'client') return true;
        
        try {
          const response = await clientsAPI.checkProfile();
          const isComplete = response.data.data.profile_completed;
          set({ isProfileComplete: isComplete });
          return isComplete;
        } catch (error) {
          set({ isProfileComplete: false });
          return false;
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),

    clearError: () => set({ error: null }),
  })
);
