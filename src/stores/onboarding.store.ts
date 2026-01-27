import { create } from 'zustand';
import { OnboardingData } from '@/types/user.type';

interface OnboardingState {
  // Collected data
  data: Partial<OnboardingData>;

  // Actions
  setHasPassport: (hasPassport: boolean) => void;
  setCountry: (countryCode: string) => void;
  setPersonalInfo: (firstName: string, lastName: string) => void;
  getData: () => OnboardingData;
  reset: () => void;
}

const initialData: Partial<OnboardingData> = {
  hasPassport: undefined,
  residentialCountry: undefined,
  firstName: undefined,
  lastName: undefined,
};

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  data: { ...initialData },

  setHasPassport: (hasPassport: boolean) => {
    set((state) => ({
      data: { ...state.data, hasPassport },
    }));
  },

  setCountry: (countryCode: string) => {
    set((state) => ({
      data: { ...state.data, residentialCountry: countryCode },
    }));
  },

  setPersonalInfo: (firstName: string, lastName: string) => {
    set((state) => ({
      data: { ...state.data, firstName, lastName },
    }));
  },

  getData: () => {
    const { data } = get();
    return {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      residentialCountry: data.residentialCountry,
      hasPassport: data.hasPassport ?? false,
    };
  },

  reset: () => {
    set({ data: { ...initialData } });
  },
}));
