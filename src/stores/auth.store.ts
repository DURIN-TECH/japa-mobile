import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authService,
  FirebaseUser,
  ConfirmationResult,
} from '@/services/auth.service';
import { apiService } from '@/services/api.service';
import { pushNotificationService } from '@/services/push-notification.service';
import {
  UserProfile,
  OnboardingData,
  NotificationPreferences,
} from '@/types/user.type';

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
  // Send (or re-send) the branded "verify your email" message via the backend.
  // Defaults to the signed-in user's email when none is passed. Best-effort.
  sendEmailVerification: (email?: string) => Promise<boolean>;

  // Account management (email/password users only; each reauthenticates first).
  // changePassword: reauth → Firebase updatePassword → branded "password changed"
  //   security notice (backend, best-effort).
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<boolean>;
  // changeEmail: reauth → backend starts the branded verify-and-change flow. The
  //   change only completes after the user clicks the link in their NEW inbox.
  changeEmail: (currentPassword: string, newEmail: string) => Promise<boolean>;
  // deleteAccount: reauth → backend deletes the profile + Auth user and emails a
  //   confirmation → local session cleared.
  deleteAccount: (currentPassword: string) => Promise<boolean>;
  // updateNotificationPreferences: toggle email/push channels for notifications.
  //   Partial patch (one channel at a time); updates the cached profile on success.
  updateNotificationPreferences: (
    prefs: Partial<NotificationPreferences>,
  ) => Promise<boolean>;

  // Actions - Phone auth (return true on success, false on error)
  sendOtp: (phoneNumber: string) => Promise<boolean>;
  verifyOtp: (code: string) => Promise<boolean>;
  clearPhoneAuth: () => void;

  // Actions - Common
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<boolean>;
  finalizeOnboarding: () => void;
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
          // Register for push notifications after successful login
          pushNotificationService.initialize().catch(() => {});
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

      // Whitelabeled "forgot password".
      // Calls the BACKEND (POST /auth/forgot-password) so the reset email is the
      // Seli-branded Resend template, NOT Firebase's stock client-side email
      // (authService.resetPassword). This is a PUBLIC endpoint — no user is signed
      // in, so the axios interceptor attaches no token, which is expected.
      //
      // The backend is enumeration-safe: it returns the same success whether or not
      // the email maps to an account, so `true` here just means "request accepted".
      resetPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.post('/auth/forgot-password', {
            email,
          });
          // 2xx with success:false shouldn't normally happen, but guard anyway.
          if (!response.success) {
            set({ error: response.message || 'Failed to send reset email' });
            return false;
          }
          return true;
        } catch (error) {
          // apiService rejects with an ApiError { code, message, status } on non-2xx
          // (e.g. a 400 for a malformed email) or network failure — its `message`
          // is already human-readable, so surface it directly.
          const message =
            (error as { message?: string })?.message ||
            'Failed to send reset email';
          set({ error: message });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      // Whitelabeled "verify your email".
      // Calls the BACKEND (POST /auth/resend-verification) so the verification email
      // is the Seli-branded Resend template. Sign-up itself is client-side Firebase,
      // which sends no verification email by default — this fills that gap.
      //
      // Best-effort by design: we never block registration/onboarding on it. Returns
      // false (and records `error`) on a hard failure, but callers typically ignore
      // the result and just fire-and-forget after sign-up.
      sendEmailVerification: async (email?: string) => {
        const to = email ?? get().user?.email ?? undefined;
        if (!to) {
          set({ error: 'No email address to verify' });
          return false;
        }
        try {
          const response = await apiService.post('/auth/resend-verification', {
            email: to,
          });
          return !!response.success;
        } catch (error) {
          const message =
            (error as { message?: string })?.message ||
            'Failed to send verification email';
          set({ error: message });
          return false;
        }
      },

      // ── Account management ──────────────────────────────────────────────────
      // Change the password. Firebase does the actual change client-side (after a
      // fresh reauthentication); the backend call only fires the branded "your
      // password was changed" security email (best-effort — never blocks success).
      changePassword: async (currentPassword: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        try {
          await authService.reauthenticate(currentPassword);
          await authService.updatePassword(newPassword);
          // Security heads-up email + in-app/push notice. Fire-and-forget: the
          // password is already changed, so a delivery hiccup mustn't fail the UX.
          apiService.post('/users/me/password-changed').catch(() => {});
          return true;
        } catch (error) {
          set({ error: authService.getErrorMessage(error) });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      // Start a verification-gated email change. We reauthenticate, then the backend
      // mints a branded verify-and-change link to the NEW address (and warns the OLD
      // one). The email only flips once the user confirms from the new inbox, so a
      // `true` here means "confirmation email sent", NOT "email changed".
      changeEmail: async (currentPassword: string, newEmail: string) => {
        set({ isLoading: true, error: null });
        try {
          await authService.reauthenticate(currentPassword);
          const response = await apiService.post('/users/me/change-email', {
            newEmail: newEmail.trim(),
          });
          if (!response.success) {
            set({ error: response.message || 'Failed to start email change' });
            return false;
          }
          return true;
        } catch (error) {
          // Firebase reauth errors carry a `code` (mapped by getErrorMessage);
          // backend ApiErrors carry a human-readable `message` (also returned).
          set({ error: authService.getErrorMessage(error) });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      // Permanently delete the account. Reauthenticate, then let the backend send
      // the confirmation email + delete the Firestore profile AND the Firebase Auth
      // user. Finally clear the local session so the app returns to the auth entry.
      deleteAccount: async (currentPassword: string) => {
        set({ isLoading: true, error: null });
        try {
          await authService.reauthenticate(currentPassword);
          const response = await apiService.delete('/users/me');
          if (!response.success) {
            set({ error: response.message || 'Failed to delete account' });
            return false;
          }
          // Stop push delivery, then sign out locally. The server-side Auth user is
          // already gone, so this just tears down the client session/state.
          await pushNotificationService.unregisterToken().catch(() => {});
          await authService.logout().catch(() => {});
          set({
            user: null,
            profile: null,
            isAuthenticated: false,
            confirmationResult: null,
            phoneNumber: null,
          });
          return true;
        } catch (error) {
          set({ error: authService.getErrorMessage(error) });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      // Update notification channel preferences (email/push). PATCHes a partial
      // body and, on success, merges the server's authoritative prefs back into the
      // cached profile so the toggles reflect persisted state. Returns false (and
      // leaves the profile untouched) on failure so callers can revert the UI.
      updateNotificationPreferences: async (
        prefs: Partial<NotificationPreferences>,
      ) => {
        try {
          const response = await apiService.patch<NotificationPreferences>(
            '/users/me/notification-preferences',
            prefs,
          );
          if (!response.success || !response.data) {
            return false;
          }
          // Reflect the persisted prefs on the cached profile (if we have one).
          const profile = get().profile;
          if (profile) {
            set({
              profile: { ...profile, notificationPreferences: response.data },
            });
          }
          return true;
        } catch {
          return false;
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
          // Register for push notifications after successful phone auth
          pushNotificationService.initialize().catch(() => {});
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
          // Unregister FCM token before signing out so the device
          // stops receiving push notifications for this user
          await pushNotificationService.unregisterToken().catch(() => {});
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

      completeOnboarding: async (data: OnboardingData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.post<UserProfile>(
            '/users/onboarding',
            data,
          );
          if (response.success && response.data) {
            // Store the profile but don't trigger redirect yet
            // The complete screen will call finalizeOnboarding to trigger the redirect
            set({ profile: { ...response.data, onboardingCompleted: false } });
          }
          return true;
        } catch (error) {
          const apiError = error as { message?: string };
          set({ error: apiError.message || 'Failed to complete onboarding' });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      finalizeOnboarding: () => {
        const profile = get().profile;
        if (profile) {
          set({ profile: { ...profile, onboardingCompleted: true } });
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
      partialize: () => ({
        // We don't persist user or profile - Firebase Auth handles persistence
        // Just persist any app-level auth preferences if needed
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
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
