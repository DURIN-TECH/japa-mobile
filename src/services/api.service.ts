import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { getApp } from '@react-native-firebase/app';
import { getAuth, getIdToken, signOut } from '@react-native-firebase/auth';
import { router } from 'expo-router';
// Backend base URL is resolved centrally by environment (deployed dev/prod or the
// local emulator) so it can never drift from the Firebase project Auth targets.
import { API_URL } from '@/config/env';

const API_BASE_URL = API_URL;

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
      // Handle 401 Unauthorized.
      //
      // A 401 is NOT automatically a reason to nuke the session. It can also be a
      // transient stale/expired token, or a stray authed request that fired before
      // Firebase restored the user (cold start) / after logout — in which case
      // there's no session to end at all. The old handler blanket-signed-out and
      // redirected on every 401, which (a) yanked navigation to /welcome mid-flow
      // and (b) logged "[auth/no-current-user]" when it tried to sign out a user
      // that was already gone. Handle the cases distinctly instead:
      if (error.response.status === 401) {
        const auth = getAuth(getApp());
        const user = auth.currentUser;
        const original = error.config as
          | (InternalAxiosRequestConfig & { _retry?: boolean })
          | undefined;

        // 1) We DO have a signed-in user and haven't retried yet → the token is
        //    likely just stale. Force-refresh it once and replay the request
        //    before deciding this is a real auth failure.
        if (user && original && !original._retry) {
          original._retry = true;
          try {
            const fresh = await getIdToken(user, /* forceRefresh */ true);
            original.headers.Authorization = `Bearer ${fresh}`;
            return api(original);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            // Fall through to the sign-out path below.
          }
        }

        // 2) Genuine auth failure. Only tear down the session (and let the root
        //    route guard send the user to the auth flow) when a user is actually
        //    signed in. If currentUser is already null, this was a stray/expired
        //    request — there's nothing to sign out of, and the _layout guard
        //    already owns "not authenticated → /welcome", so we don't hijack
        //    navigation here.
        if (auth.currentUser) {
          console.log('Unauthorized - signing out and redirecting to login');
          try {
            await signOut(auth);
          } catch (signOutError) {
            console.error('Error signing out:', signOutError);
          }
          router.replace('/(auth)/welcome');
        }
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
