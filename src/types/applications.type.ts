// Application types matching backend schema

export type ApplicationStatus =
  | 'draft'
  | 'pending_payment'
  | 'pending_documents'
  | 'under_review'
  | 'submitted_to_embassy'
  | 'interview_scheduled'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

export type ApplicationMode = 'self' | 'agent';

export type PaymentStatus =
  | 'pending'
  | 'partial'
  | 'paid'
  | 'refunded'
  | 'failed';

export interface Application {
  id: string;
  userId: string;
  visaTypeId: string;
  countryCode: string;

  // Mode
  mode: ApplicationMode;
  agentId?: string;

  // Status & Progress
  status: ApplicationStatus;
  progress: number;
  currentStep: string;
  nextStep?: string;

  // Key dates
  startDate: string;
  lastUpdated: string;
  submittedAt?: string;
  completedAt?: string;
  interviewDate?: string;

  // Documents summary
  documentsRequired: number;
  documentsUploaded: number;
  documentsVerified: number;
  documentsRejected: number;

  // Financial
  totalCost: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;

  // Denormalized display fields (populated by backend)
  visaTypeName?: string;
  countryName?: string;
  clientName?: string;
  clientEmail?: string;
  agentName?: string;

  // Notes
  userNotes?: string;
  agentNotes?: string;
  rejectionReason?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ApplicationTimeline {
  id: string;
  applicationId: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming' | 'blocked';
  date: string;
  completedAt?: string;
  responsibility: 'user' | 'agent' | 'embassy' | 'system';
  createdAt: string;
}

export interface CreateApplicationInput {
  visaTypeId: string;
  countryCode: string;
  mode: ApplicationMode;
  agentId?: string;
  userNotes?: string;
}
