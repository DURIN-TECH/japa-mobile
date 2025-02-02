import AsyncStorage from "@react-native-async-storage/async-storage";
import StorageKeys from "@/constants/Storage";

export const setOnboardingStatus = async (value: string) => {
  return await AsyncStorage.setItem(StorageKeys.ONBOARDING_STATUS_KEY, value);
}

export const getOnboardingStatus = async () => {
  return await AsyncStorage.getItem(StorageKeys.ONBOARDING_STATUS_KEY);
}

export const removeOnboardingStatus = async () => {
  return await AsyncStorage.removeItem(StorageKeys.ONBOARDING_STATUS_KEY);
}
