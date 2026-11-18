import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
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
// The Documents screen's mapper: decides which rows count as uploaded files.
import { mapDocument } from '@/components/explorer/liveDocuments';

// A single document paired with the application it belongs to. The application
// context supplies the human-readable label + destination country used by the
// Explorer "My documents" screen's meta line.
export type MyDocument = { doc: Document; app: Application };

// How many applications to fan out over. The backend has no "all my documents"
// endpoint, so `useMyDocuments` fetches documents per-application; capping the
// count bounds the request fan-out for users with many applications.
export const MY_DOCUMENTS_APP_CAP = 10;

/**
 * Everything the "my documents" fan-out found, plus whether it is the WHOLE
 * picture (japa#346). `complete` is false when the applications request
 * failed, any per-application documents request failed, or the user has more
 * applications than MY_DOCUMENTS_APP_CAP — in each case `docs` may be an
 * undercount, so a count built on it must show "–" rather than a number.
 */
export type MyDocumentsResult = { docs: MyDocument[]; complete: boolean };

// Shared cache key: the list hook and the count hook read ONE query, so the
// Profile row and the Documents screen never fetch twice.
const MY_DOCUMENTS_KEY = ['documents', 'mine'] as const;

/**
 * The fan-out itself (exported for tests):
 *   1. fetch the user's applications (`GET /applications`),
 *   2. fetch each application's documents in parallel (first
 *      MY_DOCUMENTS_APP_CAP applications only), and
 *   3. flatten them, pairing each document with its parent application.
 *
 * Never rejects: a failed sub-request contributes nothing to `docs` (so one bad
 * application can't blank the Documents screen) and marks the result
 * incomplete instead.
 */
export async function fetchMyDocuments(): Promise<MyDocumentsResult> {
  // 1. The user's applications. Failure → nothing known at all.
  let apps: Application[] = [];
  try {
    const res = await apiService.get<Application[]>('/applications');
    apps = res.data ?? [];
  } catch {
    return { docs: [], complete: false };
  }

  // Over the cap → some applications' documents are never fetched.
  let complete = apps.length <= MY_DOCUMENTS_APP_CAP;

  // 2. Each application's documents in parallel (capped fan-out).
  const perApp = await Promise.all(
    apps.slice(0, MY_DOCUMENTS_APP_CAP).map(async (app) => {
      try {
        const res = await apiService.get<Document[]>(
          `/applications/${app.id}/documents`,
        );
        // 3. Pair each document with its application for downstream context.
        return (res.data ?? []).map((doc) => ({ doc, app }));
      } catch {
        complete = false;
        return [] as MyDocument[];
      }
    }),
  );

  // Flatten the per-application arrays into a single document list.
  return { docs: perApp.flat(), complete };
}

/**
 * Every document across the current user's applications (the Documents
 * screen's list). Fully defensive, as before japa#346: whatever loaded is
 * listed, and a failed sub-request simply adds nothing.
 */
export function useMyDocuments() {
  return useQuery({
    queryKey: MY_DOCUMENTS_KEY,
    queryFn: fetchMyDocuments,
    select: (r: MyDocumentsResult): MyDocument[] => r.docs,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * How many files the user has uploaded (Profile's "My documents" row,
 * japa#346), or null when that can't be known for sure: still loading, or the
 * fan-out was incomplete (see `MyDocumentsResult`). Same cache as
 * `useMyDocuments`.
 */
export function useMyDocumentsCount() {
  return useQuery({
    queryKey: MY_DOCUMENTS_KEY,
    queryFn: fetchMyDocuments,
    select: uploadedFileCount,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * The uploaded-file count for a fan-out result, or null when it is incomplete.
 *
 * "Uploaded" = every document the Documents screen lists under "All" except
 * its `missing` rows (`pending_upload` / `uploading`: a placeholder with no
 * file behind it yet). Classified with the screen's own mapper, so the two
 * can't drift apart.
 */
export function uploadedFileCount(r: MyDocumentsResult): number | null {
  if (!r.complete) return null;
  return r.docs.filter(
    ({ doc, app }) => mapDocument(doc, app).status !== 'missing',
  ).length;
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
        // japa#346: the cross-application list + Profile's "N files" count.
        // (Its key is not under ['documents', applicationId], so the call
        // above does not reach it.)
        queryClient.invalidateQueries({ queryKey: MY_DOCUMENTS_KEY });
        // #114: an upload against a checklist item flips it to "uploaded", so
        // the checklist re-reads without a manual refresh.
        queryClient.invalidateQueries({
          queryKey: ['checklist', data.applicationId],
        });
        // #115: the upload also queued a document check; look for it now.
        queryClient.invalidateQueries({
          queryKey: ['documentChecks', data.applicationId],
        });
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
      // japa#346: the cross-application list + Profile's "N files" count.
      queryClient.invalidateQueries({ queryKey: MY_DOCUMENTS_KEY });
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
export function useSharedDocuments(
  applicationId?: string,
  // False skips the call: a self-service-only build (japa#334) hides the
  // agency-shared documents section. Default true.
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['documents', 'shared', applicationId ?? 'all'],
    enabled: opts.enabled ?? true,
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
 * Upload a document to Firebase Storage using a signed URL.
 *
 * The file goes straight from its uri to the URL as binary content (native
 * upload), with no `fetch(uri).blob()` round-trip: since Expo SDK 56.0.24 RN's
 * Blob path goes through base64 and the PUT silently did not land, so the next
 * step ("create document") failed with "File not found in storage".
 *
 * Throws when storage does not answer 2xx, so a failed PUT surfaces as the
 * upload error and the document record is never created.
 */
export async function uploadToStorage(
  uploadUrl: string,
  file: { uri: string; type: string; name: string },
  // Extra headers the signed URL requires (e.g. a size-limit header).
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  const result = await uploadAsync(uploadUrl, file.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: { ...extraHeaders, 'Content-Type': file.type },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Storage upload failed with status ${result.status}`);
  }
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
