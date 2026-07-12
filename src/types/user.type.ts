// User types matching backend schema

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Per-user notification channel preferences (opt-out model). `false` = channel off.
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  dateOfBirth?: string; // ISO date string
  address?: Address;
  residentialCountry?: string;
  profilePhotoUrl?: string;

  // Onboarding status
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string;

  // Passport info
  hasPassport: boolean;
  passportNumber?: string;
  passportExpiryDate?: string;
  passportCountry?: string;

  // Client identity verification (KYC) — absent on unverified users.
  identityVerification?: IdentityVerification;

  // Notification channel preferences (email/push on-off). Absent = both on
  // (opt-out model); `in_app` is always delivered and not represented here.
  notificationPreferences?: NotificationPreferences;

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// ---- Client identity verification (applicant KYC) ----
// Mirrors the backend `UserIdentityVerification` shape (dates as ISO strings here).

export type IdentityVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'under_review'
  | 'verified'
  | 'failed';

// One normalized check outcome (BVN/NIN lookup), as returned by the backend.
export interface IdentityCheckResult {
  checkType: string;
  provider: string;
  status: 'pending' | 'passed' | 'failed' | 'needs_review';
  confidence?: number;
  reason?: string;
  checkedAt?: string;
}

export interface IdentityVerification {
  status: IdentityVerificationStatus;
  idType?: 'nin' | 'bvn';
  checks?: Record<string, IdentityCheckResult>;
  submittedAt?: string;
  verifiedAt?: string;
  reason?: string;
}

export interface OnboardingData {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  residentialCountry?: string;
  hasPassport: boolean;
  passportNumber?: string;
  passportExpiryDate?: string;
  passportCountry?: string;
}
