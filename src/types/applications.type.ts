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

  // japa#237: shared-route applications only (absent on every ordinary one).
  /** The shared route's name. `countryName` stays the country applied through. */
  routeName?: string;
  throughCountryCode?: string;
  /** Present on a shared-route application (the confirmed choice). */
  throughCountry?: { sharedRouteId?: string; countryCode?: string };
  /** The backend's answer to "may the country still be changed?" (never computed here). */
  canChangeThroughCountry?: boolean;
  /** Rulebook keys the application runs on. */
  routeStack?: string[];

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
  /** Ordinary start. Omitted when starting through a shared route. */
  visaTypeId?: string;
  countryCode?: string;
  /** japa#237: start through a shared route (send these INSTEAD of the two above). */
  sharedRouteId?: string;
  throughCountryCode?: string;
  competenceAnswers?: Record<string, unknown>;
  mode: ApplicationMode;
  agentId?: string;
  userNotes?: string;
  /**
   * #253: set to true once the user confirmed "start another" after the
   * backend answered 409 DUPLICATE_ACTIVE_APPLICATION. Never sent otherwise.
   */
  confirmNew?: boolean;
}
