type DocumentStatus = "pending" | "uploaded" | "verified" | "failed";

interface DocumentRequirement {
  id: string;
  title: string;
  description: string;
  required: boolean;
  format: string[];
  maxSize: number; // in MB
}

interface Document {
  id: string;
  requirementId: string;
  userId: string;
  fileUrl: string;
  status: DocumentStatus;
  uploadedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  failureReason?: string;
  comments?: string;
}

interface Agent {
  id: string;
  name: string;
  rating: number;
  verificationCount: number;
  price: number;
  specializations: string[];
  availability: boolean;
}

export type { DocumentRequirement, Document, DocumentStatus, Agent };