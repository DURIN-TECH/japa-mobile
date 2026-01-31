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
  isActive: boolean;
  quotaLimit?: number;
  currentQuotaUsed?: number;
  agentIds: string[];
}

export interface RequiredDocument {
  id: string;
  name: string;
  description: string;
  acceptedFormats: string[];
  maxSizeMb: number;
  isRequired: boolean;
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
