import { createContext, ReactNode, useContext, useMemo, useState } from "react";

interface OnboardingContextType {
  onboardingData: {
    firstName: string;
    lastName: string;
    email: string;
    residentialCountry: string;
    destinationCountry: string;
    destinationVisa: string;
    hasPassport: boolean;
    hasVisa: boolean;
    hasFlight: boolean;
    hasAccommodation: boolean;
    hasInsurance: boolean;
    hasCovidTest: boolean;
    hasCovidVaccine: boolean;
    hasTravelInsurance: boolean;
    completedOnboarding: null | boolean;
  };
  updateOnboardingData: (data: any) => void;
}
 
const OnboardingContext = createContext<OnboardingContextType | undefined>({} as OnboardingContextType);

export function OnboardingProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [onboardingData, setOnboardingData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    residentialCountry: '',
    destinationCountry: '',
    destinationVisa: '',
    hasPassport: false,
    hasVisa: false,
    hasFlight: false,
    hasAccommodation: false,
    hasInsurance: false,
    hasCovidTest: false,
    hasCovidVaccine: false,
    hasTravelInsurance: false,
    completedOnboarding: null as boolean | null,
  });

  function updateOnboardingData(data: OnboardingContextType['onboardingData']) {
    setOnboardingData(prev => ({
      ...prev, ...data
    }));
  };

  const value = useMemo(() => ({ onboardingData, updateOnboardingData }), [onboardingData]);

  return (
    <OnboardingContext.Provider value={value}>
      { children }
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(){ 
    const context = useContext(OnboardingContext);
    if (!context) {
      throw new Error('useOnboarding must be used inside an OnboardingProvider')
    }
    return context;
}
