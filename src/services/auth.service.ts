import { Platform } from 'react-native';
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
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';

export type ConfirmationResult = FirebaseAuthTypes.ConfirmationResult;
export type FirebaseUser = FirebaseAuthTypes.User;

// Connect to Auth emulator in development.
// Android emulators can't reach the host machine via "localhost" — that's the emulator itself.
// Use 10.0.2.2 instead (Android emulator's alias for the host's loopback).
const USE_EMULATOR = __DEV__;
const AUTH_EMULATOR_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const AUTH_EMULATOR_PORT = 9099;

// Get auth instance once
const authInstance = getAuth(getApp());

// Initialize emulator connection
if (USE_EMULATOR) {
  connectAuthEmulator(
    authInstance,
    `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`,
  );
  console.log(
    'Auth emulator connected at',
    `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`,
  );
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
