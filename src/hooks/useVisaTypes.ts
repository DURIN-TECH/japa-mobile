import { useState, useEffect } from 'react';
import { VisaType } from '@/types/visas';

const MOCK_VISA_TYPES: VisaType[] = [
  {
    id: 'h1b',
    name: 'H-1B Work Visa',
    description: 'For foreign workers in specialty occupations',
    requirements: [
      {
        id: 'edu',
        title: 'Educational Qualification',
        description: "Bachelor's degree or higher in related field",
        estimatedTime: '1-2 weeks',
        documents: ['Degree Certificate', 'Transcripts', 'Evaluations'],
      },
      {
        id: 'emp',
        title: 'Employment Details',
        description: 'Valid job offer from US employer',
        estimatedTime: '2-3 weeks',
        documents: [
          'Job Offer Letter',
          'Employment Contract',
          'Company Documents',
        ],
      },
    ],
    agents: ['agent1', 'agent2'],
    processingTime: '6-8 months',
    price: 460,
    country: 'United States',
  },
  {
    id: 'f1',
    name: 'F-1 Student Visa',
    description: 'For international students studying in the US',
    requirements: [
      {
        id: 'i20',
        title: 'Form I-20',
        description:
          'Certificate of Eligibility for Nonimmigrant Student Status',
        estimatedTime: '1 week',
        documents: ['School Acceptance Letter', 'I-20 Form'],
      },
      {
        id: 'fin',
        title: 'Financial Documents',
        description: 'Proof of sufficient funds for study and living expenses',
        estimatedTime: '1-2 weeks',
        documents: [
          'Bank Statements',
          'Sponsorship Letter',
          'Scholarship Documents',
        ],
      },
    ],
    agents: ['agent1'],
    processingTime: '2-3 months',
    price: 350,
    country: 'United States',
  },
];

export function useVisaTypes() {
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVisaTypes = async () => {
      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setVisaTypes(MOCK_VISA_TYPES);
      } catch (error) {
        console.error('Error fetching visa types:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisaTypes();
  }, []);

  const getVisaType = (id: string) => {
    return visaTypes.find((visa) => visa.id === id);
  };

  return { visaTypes, isLoading, getVisaType };
}
