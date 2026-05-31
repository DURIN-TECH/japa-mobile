import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  EligibilityQuestion,
  EligibilityCheck,
  EligibilityCheckInput,
  VisaPreCheckInput,
  VisaPreCheckResult,
  EligibilityLevel,
  SuggestedPath,
} from '@/types/eligibility.type';

/**
 * Pre-check: Does the user need a visa?
 */
export function useVisaPreCheck() {
  return useMutation({
    mutationFn: async (input: VisaPreCheckInput) => {
      const response = await apiService.post<VisaPreCheckResult>(
        '/eligibility/pre-check',
        input,
      );
      return response.data;
    },
  });
}

/**
 * Get eligibility questions for a visa type
 */
export function useEligibilityQuestions(
  visaTypeId: string,
  nationality?: string,
  destinationCountry?: string,
) {
  const params = new URLSearchParams();
  if (nationality) params.append('nationality', nationality);
  if (destinationCountry)
    params.append('destinationCountry', destinationCountry);

  const queryString = params.toString();
  const endpoint = `/eligibility/questions/${visaTypeId}${
    queryString ? `?${queryString}` : ''
  }`;

  return useQuery({
    queryKey: [
      'eligibilityQuestions',
      visaTypeId,
      nationality,
      destinationCountry,
    ],
    queryFn: async () => {
      const response = await apiService.get<EligibilityQuestion[]>(endpoint);
      return response.data ?? [];
    },
    enabled: !!visaTypeId,
    staleTime: 1000 * 60 * 10, // 10 minutes - questions don't change often
  });
}

/**
 * Submit eligibility check
 */
export function useSubmitEligibilityCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EligibilityCheckInput) => {
      const response = await apiService.post<EligibilityCheck>(
        '/eligibility/check',
        input,
      );
      return response.data;
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['eligibilityChecks'] });
        queryClient.invalidateQueries({
          queryKey: ['eligibilityCheck', data.visaTypeId],
        });
      }
    },
  });
}

/**
 * Get user's eligibility check history
 */
export function useEligibilityChecks() {
  return useQuery({
    queryKey: ['eligibilityChecks'],
    queryFn: async () => {
      const response = await apiService.get<EligibilityCheck[]>(
        '/eligibility/checks',
      );
      return response.data ?? [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get a specific eligibility check by ID
 */
export function useEligibilityCheck(checkId: string) {
  return useQuery({
    queryKey: ['eligibilityCheck', checkId],
    queryFn: async () => {
      const response = await apiService.get<EligibilityCheck>(
        `/eligibility/checks/${checkId}`,
      );
      return response.data;
    },
    enabled: !!checkId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Get the latest eligibility check for a visa type
 */
export function useLatestEligibilityCheck(visaTypeId: string) {
  return useQuery({
    queryKey: ['eligibilityCheck', 'latest', visaTypeId],
    queryFn: async () => {
      const response = await apiService.get<EligibilityCheck | null>(
        `/eligibility/checks/latest/${visaTypeId}`,
      );
      return response.data;
    },
    enabled: !!visaTypeId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Helper to get eligibility level display info
 */
export function getEligibilityLevelInfo(level: EligibilityLevel): {
  label: string;
  color: string;
  bgColor: string;
  darkColor: string;
  darkBgColor: string;
  description: string;
} {
  const levelMap: Record<
    EligibilityLevel,
    {
      label: string;
      color: string;
      bgColor: string;
      darkColor: string;
      darkBgColor: string;
      description: string;
    }
  > = {
    high: {
      label: 'High Eligibility',
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      darkColor: 'text-green-300',
      darkBgColor: 'bg-green-900/50',
      description: 'You have a strong profile for this visa',
    },
    medium: {
      label: 'Medium Eligibility',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      darkColor: 'text-yellow-300',
      darkBgColor: 'bg-yellow-900/50',
      description: 'You may be eligible with some improvements',
    },
    low: {
      label: 'Low Eligibility',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      darkColor: 'text-red-300',
      darkBgColor: 'bg-red-900/50',
      description: 'Consider consulting an agent before applying',
    },
    not_applicable: {
      label: 'Visa Not Required',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      darkColor: 'text-blue-300',
      darkBgColor: 'bg-blue-900/50',
      description: 'You may not need a visa for this trip',
    },
  };

  return levelMap[level] || levelMap.medium;
}

/**
 * Helper to get suggested path display info
 */
export function getSuggestedPathInfo(path: SuggestedPath): {
  label: string;
  description: string;
  icon: 'self' | 'agent' | 'warning' | 'check';
  color: string;
} {
  const pathMap: Record<
    SuggestedPath,
    {
      label: string;
      description: string;
      icon: 'self' | 'agent' | 'warning' | 'check';
      color: string;
    }
  > = {
    visa_free: {
      label: 'No Visa Required',
      description: 'You can travel without applying for a visa',
      icon: 'check',
      color: 'green',
    },
    self_service: {
      label: 'Self-Service Application',
      description: 'Apply on your own with our guided process',
      icon: 'self',
      color: 'blue',
    },
    agent_assisted: {
      label: 'Agent Recommended',
      description: 'An agent can help strengthen your application',
      icon: 'agent',
      color: 'yellow',
    },
    not_eligible: {
      label: 'Consult an Expert',
      description: 'Speak with an agent to explore your options',
      icon: 'warning',
      color: 'red',
    },
  };

  return pathMap[path] || pathMap.agent_assisted;
}

/**
 * Helper to calculate progress percentage through questions
 */
export function calculateQuestionProgress(
  currentIndex: number,
  totalQuestions: number,
): number {
  if (totalQuestions === 0) return 0;
  return Math.round(((currentIndex + 1) / totalQuestions) * 100);
}

/**
 * Helper to format score display
 */
export function formatEligibilityScore(score: number): {
  percentage: string;
  color: string;
} {
  const percentage = `${score}%`;

  let color = 'text-red-600';
  if (score >= 75) {
    color = 'text-green-600';
  } else if (score >= 50) {
    color = 'text-yellow-600';
  }

  return { percentage, color };
}
