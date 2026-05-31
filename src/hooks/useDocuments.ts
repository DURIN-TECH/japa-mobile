import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  Document,
  DocumentStatus,
  UploadUrlResponse,
  CreateDocumentInput,
} from '@/types/documents.type';

/**
 * Get all documents for an application
 */
export function useApplicationDocuments(
  applicationId: string,
  requirementId?: string,
) {
  return useQuery({
    queryKey: ['documents', applicationId, requirementId],
    queryFn: async () => {
      const endpoint = requirementId
        ? `/applications/${applicationId}/documents?requirementId=${requirementId}`
        : `/applications/${applicationId}/documents`;
      const response = await apiService.get<Document[]>(endpoint);
      return response.data ?? [];
    },
    enabled: !!applicationId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Get a specific document by ID
 */
export function useDocument(documentId: string) {
  return useQuery({
    queryKey: ['document', documentId],
    queryFn: async () => {
      const response = await apiService.get<Document>(
        `/documents/${documentId}`,
      );
      return response.data;
    },
    enabled: !!documentId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Get upload URL for a new document
 */
export function useGetUploadUrl() {
  return useMutation({
    mutationFn: async ({
      applicationId,
      fileName,
      contentType,
    }: {
      applicationId: string;
      fileName: string;
      contentType: string;
    }) => {
      const response = await apiService.post<UploadUrlResponse>(
        '/documents/upload-url',
        {
          applicationId,
          fileName,
          contentType,
        },
      );
      return response.data;
    },
  });
}

/**
 * Register a document after successful upload
 */
export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDocumentInput) => {
      const response = await apiService.post<Document>('/documents', input);
      return response.data;
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: ['documents', data.applicationId],
        });
        queryClient.invalidateQueries({
          queryKey: ['application', data.applicationId],
        });
        queryClient.invalidateQueries({ queryKey: ['applications'] });
      }
    },
  });
}

/**
 * Delete a document
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      applicationId,
    }: {
      documentId: string;
      applicationId: string;
    }) => {
      await apiService.delete(`/documents/${documentId}`);
      return { documentId, applicationId };
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['documents', data.applicationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['application', data.applicationId],
      });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

/**
 * Get download URL for a document
 */
export function useGetDownloadUrl() {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiService.get<{ downloadUrl: string }>(
        `/documents/${documentId}/download`,
      );
      return response.data?.downloadUrl;
    },
  });
}

/**
 * Upload a document to Firebase Storage using signed URL
 */
export async function uploadToStorage(
  uploadUrl: string,
  file: { uri: string; type: string; name: string },
): Promise<void> {
  // Read file as blob
  const response = await fetch(file.uri);
  const blob = await response.blob();

  // Upload to signed URL
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: blob,
  });
}

/**
 * Helper to get status display info
 */
export function getDocumentStatusInfo(status: DocumentStatus): {
  label: string;
  color: string;
  bgColor: string;
  darkColor: string;
  darkBgColor: string;
} {
  const statusMap: Record<
    DocumentStatus,
    {
      label: string;
      color: string;
      bgColor: string;
      darkColor: string;
      darkBgColor: string;
    }
  > = {
    pending_upload: {
      label: 'Pending Upload',
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      darkColor: 'text-gray-300',
      darkBgColor: 'bg-gray-700',
    },
    uploading: {
      label: 'Uploading',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      darkColor: 'text-blue-300',
      darkBgColor: 'bg-blue-900/50',
    },
    uploaded: {
      label: 'Uploaded',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      darkColor: 'text-blue-300',
      darkBgColor: 'bg-blue-900/50',
    },
    under_review: {
      label: 'Under Review',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      darkColor: 'text-yellow-300',
      darkBgColor: 'bg-yellow-900/50',
    },
    verified: {
      label: 'Verified',
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
    resubmission_required: {
      label: 'Resubmit',
      color: 'text-orange-700',
      bgColor: 'bg-orange-100',
      darkColor: 'text-orange-300',
      darkBgColor: 'bg-orange-900/50',
    },
  };

  return statusMap[status] || statusMap.pending_upload;
}
