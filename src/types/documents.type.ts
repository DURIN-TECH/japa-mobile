// Document types matching backend schema

export type DocumentStatus =
  | 'pending_upload'
  | 'uploading'
  | 'uploaded'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'resubmission_required';

/** Who pushed the bytes. Mirrors the backend `DocumentUploaderRole`. */
export type DocumentUploaderRole = 'client' | 'agent' | 'owner' | 'admin';

/** How a document reached the agency. Mirrors the backend `DocumentUploadSource`. */
export type DocumentUploadSource =
  | 'email'
  | 'whatsapp'
  | 'in_person'
  | 'postal'
  | 'third_party'
  | 'other';

export interface Document {
  id: string;
  applicationId: string;
  /**
   * The visa requirement this document answers.
   *
   * NOT always a real requirement id: uploads that answer an ad-hoc agent ask
   * carry `docreq:<requestId>`, and documents an agency filed on the client's
   * behalf carry a synthetic key. Any UI that groups documents under
   * requirements must therefore also render the leftovers — see the "Other
   * documents" section on the self-service screen — or those documents become
   * invisible to the client.
   */
  requirementId: string;
  /** The document's OWNER (the client), which is not necessarily its uploader. */
  userId: string;

  // File info
  fileName: string;
  fileType: string;
  fileSizeMb: number;
  storageUrl: string;

  // Status
  status: DocumentStatus;

  // Descriptive metadata (set when an agency files a document for a client)
  documentType?: string;
  displayName?: string;
  description?: string;

  // Upload provenance (audit trail). Absent on documents predating it.
  uploadedByUserId?: string;
  uploadedByName?: string;
  uploadedByRole?: DocumentUploaderRole;
  /** True when agency staff uploaded this for the client. */
  uploadedOnBehalf?: boolean;
  uploadReason?: string;
  uploadSource?: DocumentUploadSource;

  // Review
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  agentComments?: string;

  // Tracking
  resubmissionCount: number;

  uploadedAt: string;
  updatedAt: string;
}

/**
 * The label to show for a document: the agency-supplied name if there is one,
 * then its category, then the raw file name.
 */
export function documentDisplayName(doc: Document): string {
  return (
    doc.displayName?.trim() ||
    doc.documentType?.trim() ||
    doc.fileName ||
    'Untitled document'
  );
}

export interface DocumentRequirement {
  id: string;
  name: string;
  description: string;
  acceptedFormats: string[];
  maxSizeMb: number;
  isRequired: boolean;
  validationCriteria?: string[];
  sampleUrl?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
}

export interface CreateDocumentInput {
  applicationId: string;
  requirementId: string;
  fileName: string;
  fileType: string;
  fileSizeMb: number;
  storagePath: string;
}

// Legacy types for backward compatibility (to be removed)
export interface Agent {
  id: string;
  name: string;
  initials: string;
  rating: number;
  verificationCount: number;
  price: number;
  description: string;
  specializations: string[];
  consultationFee: number;
  availability: boolean;
  responseTime: string;
  languages: string[];
  successRate: number;
  featuredVisas: string[];
}

export interface VerificationRequest {
  id: string;
  documentIds: string[];
  agentId: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: Date;
  completedAt?: Date;
  totalPrice: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
}

export interface ScheduleItem {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  completed: boolean;
  documents: {
    id: string;
    name: string;
    status: 'pending' | 'uploaded' | 'verified' | 'rejected';
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED DOCUMENTS (agency-authored, shared with the client)
//
// Distinct from `Document` above, which is an uploaded FILE. A `DocumentInstance`
// is a rich-text document an agent wrote from a template — a cover letter, a
// statement of purpose — which they can choose to share with their client. The
// body is ProseMirror JSON (the portal's editor format); the app renders it
// read-only via `components/explorer/ProseMirrorText`.
//
// Mirrors the backend type, with `string` dates instead of Firestore Timestamps.
// ─────────────────────────────────────────────────────────────────────────────

/** ProseMirror JSON document — opaque structured content produced by the portal editor. */
export type ProseMirrorDoc = { type: 'doc'; content?: unknown[] } & Record<
  string,
  unknown
>;

/** Whether the client can see the instance. Only `shared` is ever returned to the app. */
export type DocumentShareStatus = 'private' | 'shared';

/** A rich-text document an agency shared with this client. */
export interface SharedDocument {
  id: string;
  title: string;
  applicationId: string | null;
  shareStatus: DocumentShareStatus;
  /** Omitted in list responses; present when fetched by id. */
  content?: ProseMirrorDoc;
  /** Authoring agent's display name, denormalized by the backend. */
  createdByName?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt: string;
}
