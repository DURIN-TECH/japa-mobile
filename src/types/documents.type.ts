// Document types matching backend schema

export type DocumentStatus =
  | 'pending_upload'
  | 'uploading'
  | 'uploaded'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'resubmission_required';

export interface Document {
  id: string;
  applicationId: string;
  requirementId: string;
  userId: string;

  // File info
  fileName: string;
  fileType: string;
  fileSizeMb: number;
  storageUrl: string;

  // Status
  status: DocumentStatus;

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
