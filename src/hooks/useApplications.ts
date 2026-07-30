import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  Application,
  ApplicationTimeline,
  ApplicationStatus,
  CreateApplicationInput,
} from '@/types/applications.type';

/**
 * Get all applications for the current user
 */
export function useApplications(status?: ApplicationStatus) {
  return useQuery({
    queryKey: ['applications', status],
    queryFn: async () => {
      const endpoint = status
        ? `/applications?status=${status}`
        : '/applications';
      const response = await apiService.get<Application[]>(endpoint);
      return response.data ?? [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Get a specific application by ID
 */
export function useApplication(applicationId: string) {
  return useQuery({
    queryKey: ['application', applicationId],
    queryFn: async () => {
      const response = await apiService.get<Application>(
        `/applications/${applicationId}`,
      );
      return response.data;
    },
    enabled: !!applicationId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Get application timeline
 */
export function useApplicationTimeline(applicationId: string) {
  return useQuery({
    queryKey: ['applicationTimeline', applicationId],
    queryFn: async () => {
      const response = await apiService.get<ApplicationTimeline[]>(
        `/applications/${applicationId}/timeline`,
      );
      return response.data ?? [];
    },
    enabled: !!applicationId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Create a new application
 */
export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateApplicationInput) => {
      const response = await apiService.post<Application>(
        '/applications',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate applications list to refetch
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

/**
 * Update an application
 */
export function useUpdateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      userNotes,
    }: {
      applicationId: string;
      userNotes?: string;
    }) => {
      const response = await apiService.put<Application>(
        `/applications/${applicationId}`,
        { userNotes },
      );
      return response.data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['application', data.id] });
        queryClient.invalidateQueries({ queryKey: ['applications'] });
      }
    },
  });
}

/**
 * Delete a draft application
 */
export function useDeleteApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      await apiService.delete(`/applications/${applicationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

/**
 * Withdraw an application
 */
export function useWithdrawApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiService.put<Application>(
        `/applications/${applicationId}/status`,
        { status: 'withdrawn' },
      );
      return response.data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['application', data.id] });
        queryClient.invalidateQueries({ queryKey: ['applications'] });
      }
    },
  });
}

/**
 * Helper to get status display info
 */
export function getApplicationStatusInfo(status: ApplicationStatus): {
  label: string;
  color: string;
  bgColor: string;
  darkColor: string;
  darkBgColor: string;
} {
  const statusMap: Record<
    ApplicationStatus,
    {
      label: string;
      color: string;
      bgColor: string;
      darkColor: string;
      darkBgColor: string;
    }
  > = {
    draft: {
      label: 'Draft',
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      darkColor: 'text-gray-300',
      darkBgColor: 'bg-gray-700',
    },
    pending_payment: {
      label: 'Payment Required',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      darkColor: 'text-yellow-300',
      darkBgColor: 'bg-yellow-900/50',
    },
    pending_documents: {
      label: 'Documents Required',
      color: 'text-orange-700',
      bgColor: 'bg-orange-100',
      darkColor: 'text-orange-300',
      darkBgColor: 'bg-orange-900/50',
    },
    under_review: {
      label: 'Under Review',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      darkColor: 'text-blue-300',
      darkBgColor: 'bg-blue-900/50',
    },
    submitted_to_embassy: {
      label: 'Submitted',
      color: 'text-purple-700',
      bgColor: 'bg-purple-100',
      darkColor: 'text-purple-300',
      darkBgColor: 'bg-purple-900/50',
    },
    interview_scheduled: {
      label: 'Interview Scheduled',
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-100',
      darkColor: 'text-indigo-300',
      darkBgColor: 'bg-indigo-900/50',
    },
    approved: {
      label: 'Approved',
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      darkColor: 'text-green-300',
      darkBgColor: 'bg-green-900/50',
    },
    rejected: {
      label: 'Rejected',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      darkColor: 'text-red-300',
      darkBgColor: 'bg-red-900/50',
    },
    withdrawn: {
      label: 'Withdrawn',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      darkColor: 'text-gray-400',
      darkBgColor: 'bg-gray-700',
    },
    expired: {
      label: 'Expired',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      darkColor: 'text-gray-400',
      darkBgColor: 'bg-gray-700',
    },
  };

  return statusMap[status] || statusMap.draft;
}
