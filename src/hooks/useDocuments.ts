import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  Document,
  DocumentStatus,
  UploadUrlResponse,
  CreateDocumentInput,
  SharedDocument,
} from '@/types/documents.type';
import { Application } from '@/types/applications.type';

// A single document paired with the application it belongs to. The application
// context supplies the human-readable label + destination country used by the
// Explorer "My documents" screen's meta line.
export type MyDocument = { doc: Document; app: Application };

// How many applications to fan out over. The backend has no "all my documents"
// endpoint, so `useMyDocuments` fetches documents per-application; capping the
// count bounds the request fan-out for users with many applications.
const MY_DOCUMENTS_APP_CAP = 10;

/**
 * Aggregate every document across the current user's applications.
 *
 * There is no single "all my documents" endpoint, so this:
 *   1. fetches the user's applications (`GET /applications`),
 *   2. fetches each application's documents in parallel (capped at the first
 *      ~10 applications), and
 *   3. flattens them into one list, annotating each document with its parent
 *      application for the UI's label/meta line.
 *
 * Fully defensive: any failed sub-request yields an empty list rather than
 * rejecting the whole query, so a single bad application can't blank the screen.
 */
export function useMyDocuments() {
  return useQuery({
    queryKey: ['documents', 'mine'],
    queryFn: async (): Promise<MyDocument[]> => {
      // 1. Fetch the user's applications (empty list on failure).
      let apps: Application[] = [];
      try {
        const res = await apiService.get<Application[]>('/applications');
        apps = res.data ?? [];
      } catch {
        return [];
      }

      // 2. Fetch each application's documents in parallel (capped fan-out).
      const perApp = await Promise.all(
        apps.slice(0, MY_DOCUMENTS_APP_CAP).map(async (app) => {
          try {
            const res = await apiService.get<Document[]>(
              `/applications/${app.id}/documents`,
            );
            // 3. Pair each document with its application for downstream context.
            return (res.data ?? []).map((doc) => ({ doc, app }));
          } catch {
            return [] as MyDocument[];
          }
        }),
      );

      // Flatten the per-application arrays into a single document list.
      return perApp.flat();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

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

// ─────────────────────────────────────────────────────────────────────────────
// SHARED DOCUMENTS (agency-authored rich text, shared with this client)
//
// Backed by the client-facing `/document-instances/shared` routes. The rest of
// the `/document-instances` surface is agent-only and 403s for a client, so
// these two hooks are the app's only way in.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Documents the client's agencies have shared with them.
 *
 * With no `applicationId` the backend spans every application the client owns,
 * which is what the flat "My documents" library wants. Only documents an agent
 * has explicitly shared are ever returned — drafts stay invisible.
 */
export function useSharedDocuments(applicationId?: string) {
  return useQuery({
    queryKey: ['documents', 'shared', applicationId ?? 'all'],
    queryFn: async (): Promise<SharedDocument[]> => {
      const endpoint = applicationId
        ? `/document-instances/shared?applicationId=${encodeURIComponent(applicationId)}`
        : '/document-instances/shared';
      try {
        const response = await apiService.get<SharedDocument[]>(endpoint);
        return response.data ?? [];
      } catch {
        // Defensive, matching `useMyDocuments`: a failure here should hide the
        // section, not blank the documents screen.
        return [];
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * One shared document WITH its body — list responses omit `content`.
 *
 * Re-checked server-side on every call, so a document the agency un-shares
 * stops resolving (404) even if the client still has the row on screen.
 */
export function useSharedDocument(documentId: string) {
  return useQuery({
    queryKey: ['document', 'shared', documentId],
    queryFn: async () => {
      const response = await apiService.get<SharedDocument>(
        `/document-instances/shared/${documentId}`,
      );
      return response.data ?? null;
    },
    enabled: !!documentId,
    staleTime: 1000 * 60 * 2,
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
