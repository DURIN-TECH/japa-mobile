export type DocumentStatus = "pending" | "uploaded" | "verified" | "rejected" | "resubmitted";

export interface DocumentRequirement {
  id: string;
  title: string;
  description: string;
  required: boolean;
  format: string[];
  maxSize: number; // in MB
  validationCriteria?: string[];
}

export interface Document {
  id: string;
  requirementId: string;
  userId: string;
  fileUrl: string;
  status: DocumentStatus;
  uploadedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
  agentComments?: string[];
  resubmissionCount: number;
}

export interface Agent {
  id: string;
  name: string;
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
  status: "pending" | "in_progress" | "completed";
  createdAt: Date;
  completedAt?: Date;
  totalPrice: number;
  paymentStatus: "pending" | "paid" | "refunded";
}