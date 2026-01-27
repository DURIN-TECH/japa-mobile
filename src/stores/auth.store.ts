import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, FirebaseUser, ConfirmationResult } from '@/services/auth.service';
import { apiService } from '@/services/api.service';
import { UserProfile } from '@/types/user.type';

interface AuthState {
  // State
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Phone auth state
  confirmationResult: ConfirmationResult | null;
  phoneNumber: string | null;

  // Actions - Email auth (return true on success, false on error)
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;

  // Actions - Phone auth (return true on success, false on error)
  sendOtp: (phoneNumber: string) => Promise<boolean>;
  verifyOtp: (code: string) => Promise<boolean>;
  clearPhoneAuth: () => void;

  // Actions - Common
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  clearError: () => void;

  // Internal
  setUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;

  // Hydration
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,
      confirmationResult: null,
      phoneNumber: null,
      _hasHydrated: false,

      // Email authentication
      loginWithEmail: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const user = await authService.loginWithEmail(email, password);
          set({ user, isAuthenticated: true });
          await get().fetchProfile();
          return true;
        } catch (error) {
          set({ error: authService.getErrorMessage(error) });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      registerWithEmail: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const user = await authService.registerWithEmail(email, password);
          set({ user, isAuthenticated: true });
          await get().fetchProfile();
          return true;
        } catch (error) {
          set({ error: authService.getErrorMessage(error) });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      resetPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          await authService.resetPassword(email);
          return true;
        } catch (error) {
          set({ error: authService.getErrorMessage(error) });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      // Phone authentication
      sendOtp: async (phoneNumber: string) => {
        set({ isLoading: true, error: null });
        try {
          const confirmationResult = await authService.sendOtp(phoneNumber);
          set({ confirmationResult, phoneNumber });
          return true;
        } catch (error) {
          set({ error: authService.getErrorMessage(error) });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      verifyOtp: async (code: string) => {
        const { confirmationResult } = get();
        if (!confirmationResult) {
          set({ error: 'No verification in progress' });
          return false;
        }

        set({ isLoading: true, error: null });
        try {
          const user = await authService.verifyOtp(confirmationResult, code);
          set({
            user,
            isAuthenticated: true,
            confirmationResult: null,
            phoneNumber: null,
          });
          await get().fetchProfile();
          return true;
        } catch (error) {
          set({ error: authService.getErrorMessage(error) });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      clearPhoneAuth: () => {
        set({ confirmationResult: null, phoneNumber: null });
      },

      // Common actions
      logout: async () => {
        set({ isLoading: true });
        try {
          await authService.logout();
          set({
            user: null,
            profile: null,
            isAuthenticated: false,
            confirmationResult: null,
            phoneNumber: null,
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchProfile: async () => {
        try {
          const response = await apiService.get<UserProfile>('/users/me');
          if (response.success && response.data) {
            set({ profile: response.data });
          }
        } catch (error) {
          const apiError = error as { status?: number };
          // 404 is expected for new users who haven't completed onboarding
          if (apiError.status !== 404) {
            console.error('Error fetching profile:', error);
          }
        }
      },

      clearError: () => set({ error: null }),

      // Internal setters
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),

      // Hydration
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'japa-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist minimal data - Firebase handles the actual auth state
      partialize: (state) => ({
        // We don't persist user or profile - Firebase Auth handles persistence
        // Just persist any app-level auth preferences if needed
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Hook to check if auth store is hydrated
export const useAuthHydration = () => {
  return useAuthStore((state) => state._hasHydrated);
};

// Computed selectors
export const useIsOnboarded = () => {
  return useAuthStore((state) => state.profile?.onboardingCompleted ?? false);
};

export const useUserProfile = () => {
  return useAuthStore((state) => state.profile);
};
