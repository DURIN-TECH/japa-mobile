// Legacy types for backwards compatibility with mock data
export interface LegacyVisaType {
  id: string;
  name: string;
  description: string;
  requirements: {
    id: string;
    title: string;
    description: string;
    estimatedTime: string;
    documents: string[];
  }[];
  agents: string[];
  processingTime: string;
  price: number;
  country: string;
  curators: Curator[];
  img: string;
}

export interface Curator {
  id: string;
  name: string;
  initials: string;
}

// API types matching backend schema
export type VisaCategory =
  | 'work'
  | 'student'
  | 'tourist'
  | 'business'
  | 'family'
  | 'investor'
  | 'transit'
  | 'other';

export interface VisaType {
  id: string;
  countryCode: string;
  name: string;
  code: string;
  description: string;
  category: VisaCategory;
  processingTime: string;
  processingDaysMin: number;
  processingDaysMax: number;
  baseCostUsd: number;
  validityPeriod: string;
  isExtendable: boolean;
  maxExtensions?: number;
  eligibilityCriteria: string[];
  applicationUrl?: string; // URL to official online application form
  applicationInstructions?: string; // Brief instructions for completing official application
  successRate?: number;
  totalApplications?: number;
  /** Where the record came from, e.g. "scraped" (official-source import) vs seeded. */
  source?: string;
  isActive: boolean;
  quotaLimit?: number;
  currentQuotaUsed?: number;
  agentIds: string[];
  /**
   * japa#237: set when this visa is one route shared by several countries
   * (null / absent for an ordinary visa). Names come from the backend.
   */
  sharedRoute?: import('@/types/sharedRoute.type').PublicSharedRoute | null;
}

export interface RequiredDocument {
  id: string;
  name: string;
  description: string;
  acceptedFormats: string[];
  maxSizeMb: number;
  isRequired: boolean;
  /** #187: same meaning as on a checklist item. All optional (older data has none). */
  kind?: 'document' | 'information';
  kindReview?: true;
  kindQuote?: string;
  need?: 'required' | 'conditional' | 'optional';
  appliesWhen?: string;
  validationCriteria?: string[];
  sampleUrl?: string;
}

export interface VisaRequirement {
  id: string;
  visaTypeId: string;
  title: string;
  description: string;
  estimatedTime: string;
  orderIndex: number;
  requiredDocuments: RequiredDocument[];
  dependsOn?: string[];
  isOptional: boolean;
}

export interface VisaTypeWithRequirements {
  visaType: VisaType;
  requirements: VisaRequirement[];
}

export interface VisaApplication {
  id: string;
  visaTypeId: string;
  userId: string;
  mode: 'self' | 'agent';
  agentId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  progress: number;
  schedule: {
    requirementId: string;
    startDate: string;
    endDate: string;
    completed: boolean;
    documents: {
      id: string;
      name: string;
      status: 'pending' | 'uploaded' | 'verified' | 'rejected';
      url?: string;
    }[];
  }[];
  startDate: string;
  lastUpdated: string;
}
