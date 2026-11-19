import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authService,
  FirebaseUser,
  ConfirmationResult,
} from '@/services/auth.service';
import { apiService } from '@/services/api.service';
// #187: unsaved answer text (memory + encrypted vault) must not outlive the session.
import { useAnswerDraftsStore } from '@/stores/answerDrafts.store';
import { pushNotificationService } from '@/services/push-notification.service';
// #263: empties every per-user cache outside this store (React Query, onboarding
// answers, per-user device keys) on every sign-out path.
import { clearUserSession } from '@/services/session.service';
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
  // #263: the Firebase onAuthStateChanged handler (src/app/_layout.tsx). Applies
  // the new user AND tears the previous user's session down when the session
  // ended on its own (user → null) or the account changed (uid A → uid B).
  // Resolves once the teardown is done, so callers can then safely fetch the
  // new user's profile and register push for them.
  syncAuthUser: (user: FirebaseUser | null) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;

  // Hydration
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session tracking + teardown (issue #263)
//
// Every per-user field of this store. Reset on EVERY sign-out path (logout,
// account deletion, a session that ended on its own). `isAuthenticated` is
// handled by the callers (the account-change path keeps it true so the route
// guard doesn't bounce through /welcome).
// ─────────────────────────────────────────────────────────────────────────────
const SIGNED_OUT_USER_STATE = {
  user: null,
  profile: null,
  isAuthenticated: false,
  confirmationResult: null,
  phoneNumber: null,
  error: null,
} as const;

/**
 * The Firebase uid whose data the caches currently hold, as last seen by
 * `syncAuthUser` (or set by logout / deleteAccount).
 *   undefined → no auth event yet (app just started)
 *   null      → signed out, caches already cleared
 *   'uid'     → that user's session is live
 *
 * Kept OUTSIDE the zustand state on purpose: `loginWithEmail` writes `user`
 * into the store before Firebase's listener fires, so the store's `user` can't
 * tell us whose data is in the cache; this variable can.
 */
let sessionUid: string | null | undefined;

/**
 * Auth events run ONE AT A TIME (review round 1, #263). Each `syncAuthUser`
 * call is chained behind the previous one, so a slow teardown for user A
 * (network-bound push steps) always finishes before B's sign-in event is
 * handled. Without this, A's teardown could land after B signed in and
 * delete B's push token, clear B's cache and reset the store to signed-out.
 * `.catch` keeps one failed event from blocking every later one.
 */
let authEventChain: Promise<void> = Promise.resolve();

/**
 * Bumped synchronously on every `syncAuthUser` call. A queued event compares
 * its own number against this after each await: if a NEWER event has arrived
 * since, this one's state writes are stale and are skipped (the newer event
 * will set the state). Teardown side effects are still allowed to finish,
 * because the queue makes the newer event wait for them.
 */
let authEventSeq = 0;

/** Test-only: forget the tracked session and the queue (fresh app start). */
export const __resetSessionTrackingForTests = () => {
  sessionUid = undefined;
  authEventChain = Promise.resolve();
  authEventSeq = 0;
};

/**
 * Tear the previous user's session down on this device: stop their pushes,
 * then empty every per-user cache. Never throws.
 *
 * @param notifyBackend whether to ask the backend to drop this device's FCM
 *   token. Only true while the DEPARTING user still holds the Firebase session
 *   (logout / deleteAccount call unregisterToken directly for that). From the
 *   auth listener it is always false: the departing user's session is already
 *   gone, so the call could only fail, or worse, carry the NEXT user's ID token
 *   and remove the token from their record. The local deleteToken is what
 *   stops the old user's pushes either way.
 */
async function tearDownUserSession(notifyBackend = false): Promise<void> {
  // unregisterToken() never throws: the backend call may fail (session already
  // gone → 401) but the local token is still deleted and listeners cleaned up.
  await pushNotificationService.unregisterToken({ notifyBackend });
  await clearUserSession();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // ── Auth event handler (#263), run by syncAuthUser's queue ────────────
      // Decides, from the uid the caches belong to (`sessionUid`) and the new
      // user, which case this is. `seq` is this event's number: after every
      // await, `stale()` tells whether a newer event arrived, in which case
      // this one must not write auth state (the newer one will).
      const handleAuthEvent = async (
        user: FirebaseUser | null,
        seq: number,
      ): Promise<void> => {
        const stale = () => seq !== authEventSeq;
        const previousUid = sessionUid;
        // Record the new owner before any await (logout / deleteAccount read
        // and write it too).
        sessionUid = user?.uid ?? null;

        if (!user) {
          if (previousUid === undefined) {
            // (a) Cold start, nobody signed in. A previous session may have
            //     ended while the app was closed (revoked, deleted elsewhere),
            //     leaving its push token and device keys behind. Clean up
            //     locally; there's no session to call the backend with.
            await tearDownUserSession();
          } else if (previousUid !== null) {
            // (b) The session ended on its own: expired / revoked token, the
            //     401 handler's signOut, signed out on another device. Local
            //     push teardown only (no session left for the backend call).
            await tearDownUserSession();
          }
          // (c) previousUid === null: logout()/deleteAccount() already tore
          //     down. Either way, make sure NO per-user field survives (the
          //     old handler left `profile` set here)...
          //
          // ...unless someone signed in meanwhile: a newer event is queued, or
          // Firebase already holds a signed-in user (loginWithEmail/verifyOtp
          // write that user into the store before Firebase's listener fires).
          // Resetting then would bounce the NEW user to /welcome. Firebase's
          // live currentUser is the source of truth here, not the store.
          if (stale() || authService.getCurrentUser()) return;
          set({ ...SIGNED_OUT_USER_STATE });
          return;
        }

        if (previousUid && previousUid !== user.uid) {
          // (d) The account changed without a sign-out in between (uid A →
          //     uid B). Drop A's push token, caches and profile before B's
          //     data loads. `isAuthenticated` stays true so the route guard
          //     doesn't bounce through /welcome.
          await tearDownUserSession();
          // A sign-out (or another switch) arrived during the teardown: its
          // own event sets the state, so don't sign B back in here.
          if (stale()) return;
          set({
            profile: null,
            confirmationResult: null,
            phoneNumber: null,
            error: null,
          });
        }

        // (e) Sign-in, a relaunch with a valid session (cache untouched, so
        //     cached data still shows fast), or the tail of case (d).
        if (stale()) return;
        set({ user, isAuthenticated: true });
      };

      return {
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
            // Push registration is owned by the auth listener in _layout.tsx
            // (it fires on every sign-in); not repeated here (#265).
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
            const response = await apiService.post(
              '/auth/resend-verification',
              {
                email: to,
              },
            );
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
        changePassword: async (
          currentPassword: string,
          newPassword: string,
        ) => {
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
              set({
                error: response.message || 'Failed to start email change',
              });
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
            // #263: mark the session as ended FIRST, so the listener's null event
            // (fired by authService.logout) doesn't run the teardown a second time.
            sessionUid = null;
            await pushNotificationService.unregisterToken();
            await authService.logout().catch(() => {});
            // #263: empty the React Query cache + per-user stores/device keys
            // AFTER the Firebase sign-out, so nothing refetched in between can be
            // fetched with this user's token.
            await clearUserSession();
            set({ ...SIGNED_OUT_USER_STATE });
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
            // Push registration is owned by the auth listener in _layout.tsx
            // (it fires on every sign-in); not repeated here (#265).
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
          // #263: remember whose session this was (to restore it if the sign-out
          // fails), then mark it ended so the onAuthStateChanged null event that
          // authService.logout() fires doesn't tear down a second time.
          const previousUid = sessionUid;
          sessionUid = null;
          try {
            // Unregister FCM token before signing out so the device
            // stops receiving push notifications for this user (needs the
            // still-valid session for the backend call). Never throws.
            await pushNotificationService.unregisterToken();
            await authService.logout();
            // #263: now that requests can no longer carry this user's token,
            // cancel in-flight queries and empty every per-user cache, then reset
            // the store (which sends the route guard to /(auth)/welcome).
            await clearUserSession();
            set({ ...SIGNED_OUT_USER_STATE });
          } catch (error) {
            // Firebase sign-out failed: the user is still signed in, so the
            // session is still theirs.
            sessionUid = previousUid;
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
              set({
                profile: { ...response.data, onboardingCompleted: false },
              });
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

        // #263: Firebase auth state listener. Events are queued (authEventChain)
        // and handled one at a time; see handleAuthEvent below for the cases.
        // The returned promise resolves once THIS event has been handled.
        syncAuthUser: (user) => {
          const seq = ++authEventSeq;
          const run = authEventChain.then(() => handleAuthEvent(user, seq));
          authEventChain = run.catch(() => undefined);
          return run;
        },
        setLoading: (isLoading) => set({ isLoading }),
        setInitialized: (isInitialized) => set({ isInitialized }),

        // Hydration
        setHasHydrated: (state) => set({ _hasHydrated: state }),
      };
    },
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

// #187: forget every unsaved answer the moment the user signs out (any path:
// logout, account deletion, a session that ended). The drafts are personal
// details (in memory and in the encrypted device vault); the next person on this device must never see them.
// On sign-in, load THIS user's drafts and remove any other user's (a session that
// ended while the app was closed never fired the sign-out above).
// #263: also when the signed-in account changes with no sign-out in between
// (uid A → uid B while authenticated): forget A's drafts, load B's.
useAuthStore.subscribe((state, prev) => {
  const uid = state.user?.uid;
  const prevUid = prev.user?.uid;
  if (prev.isAuthenticated && !state.isAuthenticated)
    useAnswerDraftsStore.getState().clearAll();
  else if (!prev.isAuthenticated && state.isAuthenticated && uid)
    void useAnswerDraftsStore.getState().loadFromVault(uid);
  else if (
    prev.isAuthenticated &&
    state.isAuthenticated &&
    uid &&
    prevUid &&
    uid !== prevUid
  ) {
    useAnswerDraftsStore.getState().clearAll();
    void useAnswerDraftsStore.getState().loadFromVault(uid);
  }
});

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
