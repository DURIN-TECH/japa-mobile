import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAuth, getIdToken, signOut } from '@react-native-firebase/auth';
import { router } from 'expo-router';

// Android emulators can't reach the host's "localhost" — that resolves to the
// emulator itself. Rewrite "localhost" to 10.0.2.2 when running on Android.
const rewriteForAndroid = (url: string | undefined) =>
  Platform.OS === 'android' && url
    ? url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/])/g, '//10.0.2.2')
    : url;

const API_BASE_URL = __DEV__
  ? rewriteForAndroid(process.env.EXPO_PUBLIC_DEV_API_URL)
  : process.env.EXPO_PUBLIC_API_URL;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    const auth = getAuth(getApp());
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const token = await getIdToken(currentUser);
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Error getting auth token:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.response) {
      // Handle 401 Unauthorized - sign out and redirect to login
      if (error.response.status === 401) {
        console.log('Unauthorized - signing out and redirecting to login');
        try {
          const auth = getAuth(getApp());
          await signOut(auth);
        } catch (signOutError) {
          console.error('Error signing out:', signOutError);
        }
        // Redirect to the Explorer auth flow
        router.replace('/(auth)/welcome');
      }

      // Server responded with error status
      const apiError: ApiError = {
        code: error.response.data?.error || 'UNKNOWN_ERROR',
        message: error.response.data?.message || 'An error occurred',
        status: error.response.status,
      };
      return Promise.reject(apiError);
    } else if (error.request) {
      // Request made but no response
      const apiError: ApiError = {
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
        status: 0,
      };
      return Promise.reject(apiError);
    } else {
      // Request setup error
      const apiError: ApiError = {
        code: 'REQUEST_ERROR',
        message: error.message || 'Failed to make request',
        status: 0,
      };
      return Promise.reject(apiError);
    }
  },
);

// API service methods
export const apiService = {
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await api.get<ApiResponse<T>>(endpoint);
    return response.data;
  },

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await api.post<ApiResponse<T>>(endpoint, data);
    return response.data;
  },

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await api.put<ApiResponse<T>>(endpoint, data);
    return response.data;
  },

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await api.patch<ApiResponse<T>>(endpoint, data);
    return response.data;
  },

  async delete<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await api.delete<ApiResponse<T>>(endpoint, { data });
    return response.data;
  },
};

// Export the axios instance for advanced usage
export { api };
