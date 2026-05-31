// ============================================
// VISA EXEMPTION / REQUIREMENT
// ============================================

export type VisaRequirementType =
  | 'visa_free'
  | 'visa_on_arrival'
  | 'eta'
  | 'evisa'
  | 'visa_required';

// ============================================
// ELIGIBILITY QUESTIONS
// ============================================

export type QuestionType = 'boolean' | 'single' | 'multiple' | 'number' | 'date' | 'text';

export interface EligibilityQuestion {
  id: string;
  visaTypeId?: string;
  scope: string;

  // Question content
  question: string;
  description?: string;
  helpText?: string;
  type: QuestionType;
  options?: string[];

  // Scoring
  weight: number;
  correctAnswers?: string[];

  // For numeric questions
  minValue?: number;
  maxValue?: number;
  idealMin?: number;
  idealMax?: number;
  unit?: string;

  // Recommendations
  failRecommendation?: string;

  // Display
  orderIndex: number;
  isRequired: boolean;

  // Dependencies
  dependsOn?: {
    questionId: string;
    expectedAnswer: string | string[];
  };
}

// ============================================
// ELIGIBILITY CHECK
// ============================================

export interface EligibilityAnswer {
  questionId: string;
  answer: string | string[] | number | boolean;
}

export interface EligibilityCheckInput {
  visaTypeId: string;
  countryCode: string;
  nationality: string;
  travelPurpose?: string;
  answers: EligibilityAnswer[];
}

export interface EligibilityBreakdownItem {
  questionId: string;
  question: string;
  answer: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  recommendation?: string;
}

export type EligibilityLevel = 'high' | 'medium' | 'low' | 'not_applicable';

export type SuggestedPath = 'self_service' | 'agent_assisted' | 'not_eligible' | 'visa_free';

export interface EligibilityCheck {
  id: string;
  userId: string;
  visaTypeId: string;
  countryCode: string;
  nationality: string;

  // Pre-check result
  visaRequired: boolean;
  visaRequirementType: VisaRequirementType;
  exemptionDetails?: {
    maxStayDays?: number;
    conditions?: string[];
  };

  // Score
  score: number;
  eligibilityLevel: EligibilityLevel;

  // Breakdown
  answers: EligibilityAnswer[];
  breakdown: EligibilityBreakdownItem[];

  // Recommendations
  recommendations: string[];
  missingRequirements: string[];

  // Suggested path
  suggestedPath: SuggestedPath;

  createdAt: string;
}

// ============================================
// PRE-CHECK
// ============================================

export type TravelPurpose =
  | 'tourism'
  | 'business'
  | 'work'
  | 'study'
  | 'family'
  | 'transit'
  | 'other';

export interface VisaPreCheckInput {
  nationality: string;
  destinationCountry: string;
  travelPurpose: TravelPurpose;
  intendedStayDays?: number;
}

export interface RecommendedVisa {
  id: string;
  name: string;
  description: string;
  processingTime: string;
  baseCostUsd: number;
}

export interface VisaPreCheckResult {
  visaRequired: boolean;
  requirementType: VisaRequirementType;

  // If visa free
  maxStayDays?: number;
  conditions?: string[];

  // If visa required
  recommendedVisaTypes?: RecommendedVisa[];

  // Warnings
  warnings?: string[];

  // Next steps
  nextSteps: string[];
}

// ============================================
// ELIGIBILITY WIZARD STATE
// ============================================

export interface EligibilityWizardState {
  visaTypeId: string;
  countryCode: string;
  nationality: string;
  travelPurpose?: TravelPurpose;

  // Current step
  currentQuestionIndex: number;
  questions: EligibilityQuestion[];
  answers: Record<string, string | string[] | number | boolean>;

  // Pre-check result (if done)
  preCheckResult?: VisaPreCheckResult;

  // Final result
  result?: EligibilityCheck;
}
