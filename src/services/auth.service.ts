import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  getIdToken as firebaseGetIdToken,
  // Sensitive account-management ops. Firebase requires a *recent* sign-in for
  // these, so callers must `reauthenticate()` immediately before them.
  reauthenticateWithCredential,
  updatePassword as fbUpdatePassword,
  deleteUser as fbDeleteUser,
  EmailAuthProvider,
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';
// Emulator opt-in flag + resolved Auth-emulator URL (env-driven, platform-aware).
import { USE_EMULATOR, AUTH_EMULATOR_URL } from '@/config/env';

export type ConfirmationResult = FirebaseAuthTypes.ConfirmationResult;
export type FirebaseUser = FirebaseAuthTypes.User;

// Get auth instance once
const authInstance = getAuth(getApp());

// Connect to the Auth emulator ONLY when explicitly opted in (EXPO_PUBLIC_USE_EMULATOR).
// This must NOT be gated on __DEV__: a normal dev build targets the DEPLOYED
// durin-seli-dev backend with REAL Firebase Auth, and connecting to a local emulator
// there would mint emulator tokens the deployed backend rejects. The emulator host
// (10.0.2.2 on Android) and URL are resolved centrally in src/config/env.ts.
if (USE_EMULATOR) {
  connectAuthEmulator(authInstance, AUTH_EMULATOR_URL);
  console.log('Auth emulator connected at', AUTH_EMULATOR_URL);
}

class AuthService {
  private auth = authInstance;

  // Email/Password Authentication
  async registerWithEmail(
    email: string,
    password: string,
  ): Promise<FirebaseUser> {
    const result = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password,
    );
    return result.user;
  }

  async loginWithEmail(email: string, password: string): Promise<FirebaseUser> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    return result.user;
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  // Phone Authentication
  async sendOtp(phoneNumber: string): Promise<ConfirmationResult> {
    return await signInWithPhoneNumber(this.auth, phoneNumber);
  }

  async verifyOtp(
    confirmationResult: ConfirmationResult,
    code: string,
  ): Promise<FirebaseUser> {
    const result = await confirmationResult.confirm(code);
    if (!result?.user) {
      throw new Error('Verification failed');
    }
    return result.user;
  }

  // ── Account management (sensitive — require a recent login) ────────────────

  // Re-verify the signed-in user with their current password. Firebase demands a
  // recent credential before changing the password/email or deleting the account
  // (auth/requires-recent-login otherwise). Only valid for email/password users —
  // phone-only accounts have no password to reauthenticate with.
  async reauthenticate(currentPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.email) {
      throw new Error('No email/password account is signed in.');
    }
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword,
    );
    await reauthenticateWithCredential(user, credential);
  }

  // Change the signed-in user's password. Call `reauthenticate()` first.
  async updatePassword(newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No signed-in user.');
    await fbUpdatePassword(user, newPassword);
  }

  // Delete the Firebase Auth user client-side. The backend normally deletes it via
  // the Admin SDK (DELETE /users/me); this is a fallback / completeness helper.
  async deleteAccount(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No signed-in user.');
    await fbDeleteUser(user);
  }

  // Whether the current user signed in with email/password (vs phone-only). The
  // password/email account-management flows only apply to password accounts, so
  // screens use this to hide or disable those actions for phone users.
  hasPasswordProvider(): boolean {
    const user = this.auth.currentUser;
    return !!user?.providerData?.some((p) => p.providerId === 'password');
  }

  // Current email-verified state from the cached user (may be stale until reload).
  isEmailVerified(): boolean {
    return !!this.auth.currentUser?.emailVerified;
  }

  // Force-refresh the user from Firebase so `emailVerified` reflects a link the
  // user just clicked in their inbox. Returns the refreshed user (or null).
  async reloadUser(): Promise<FirebaseUser | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    await user.reload();
    return this.auth.currentUser;
  }

  // Common
  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  getCurrentUser(): FirebaseUser | null {
    return this.auth.currentUser;
  }

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    return firebaseOnAuthStateChanged(this.auth, callback);
  }

  async getIdToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    return await firebaseGetIdToken(user);
  }

  // Error message helper
  getErrorMessage(error: unknown): string {
    const firebaseError = error as { code?: string; message?: string };

    switch (firebaseError.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please login instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-credential':
        return 'Invalid credentials. Please check your email and password.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      case 'auth/requires-recent-login':
        return 'Please sign in again before making this change.';
      case 'auth/invalid-phone-number':
        return 'Please enter a valid phone number.';
      case 'auth/invalid-verification-code':
        return 'Invalid verification code. Please try again.';
      case 'auth/session-expired':
        return 'Verification session expired. Please request a new code.';
      default:
        return firebaseError.message || 'An error occurred. Please try again.';
    }
  }
}

export const authService = new AuthService();
