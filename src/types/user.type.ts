// User types matching backend schema

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
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

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
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
